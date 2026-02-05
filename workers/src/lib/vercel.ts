// Fixr Agent Vercel Deployment Integration
// Adapted for Cloudflare Workers (uses Web Crypto API instead of Node crypto)

import { Env } from './types';

export interface DeploymentFile {
  file: string;
  data: string; // base64 encoded content
}

export interface DeployResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  error?: string;
}

// Web Crypto compatible SHA-1 hash
async function sha1(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Base64 decode for Workers
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Deploy files directly to Vercel using their file upload API
 */
export async function deployToVercel(
  env: Env,
  projectName: string,
  files: DeploymentFile[]
): Promise<DeployResult> {
  if (!env.VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  try {
    // Step 1: Upload each file and get SHA hashes
    const uploadedFiles: { file: string; sha: string; size: number }[] = [];

    for (const f of files) {
      const content = base64ToArrayBuffer(f.data);
      const sha = await sha1(content);

      // Upload file
      const uploadResponse = await fetch('https://api.vercel.com/v2/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.VERCEL_TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'x-vercel-digest': sha,
        },
        body: content,
      });

      if (!uploadResponse.ok && uploadResponse.status !== 409) {
        const errData = await uploadResponse.json().catch(() => ({}));
        console.error('File upload failed:', f.file, errData);
        return {
          success: false,
          error: `Failed to upload ${f.file}: ${JSON.stringify(errData)}`,
        };
      }

      uploadedFiles.push({
        file: f.file,
        sha,
        size: content.byteLength,
      });
    }

    // Step 2: Create deployment with file references
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files: uploadedFiles,
        projectSettings: {
          framework: 'nextjs',
        },
        target: 'production',
      }),
    });

    const data = await response.json() as { url?: string; id?: string; error?: { message?: string } };

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || JSON.stringify(data),
      };
    }

    return {
      success: true,
      url: `https://${data.url}`,
      deploymentId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Deploy from a GitHub repo
 */
export async function deployFromGitHub(
  env: Env,
  repoUrl: string,
  projectName: string
): Promise<DeployResult> {
  if (!env.VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  try {
    // First, create/get the project
    const projectBody: Record<string, unknown> = {
      name: projectName,
      gitRepository: {
        type: 'github',
        repo: repoUrl.replace('https://github.com/', ''),
      },
      framework: 'nextjs',
    };

    const teamQuery = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';

    const projectResponse = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectBody),
    });

    const projectData = await projectResponse.json() as {
      id?: string;
      link?: { repoId?: string };
      error?: { code?: string; message?: string }
    };

    if (!projectResponse.ok && projectData.error?.code !== 'project_already_exists') {
      return {
        success: false,
        error: projectData.error?.message || 'Failed to create project',
      };
    }

    // Trigger a deployment
    const deployBody: Record<string, unknown> = {
      name: projectName,
      gitSource: {
        type: 'github',
        repoId: projectData.link?.repoId || projectData.id,
        ref: 'main',
      },
      target: 'production',
    };

    const deployResponse = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deployBody),
    });

    const deployData = await deployResponse.json() as { url?: string; id?: string; error?: { message?: string } };

    if (!deployResponse.ok) {
      return {
        success: false,
        error: deployData.error?.message || 'Deployment failed',
      };
    }

    return {
      success: true,
      url: `https://${deployData.url}`,
      deploymentId: deployData.id,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Set custom domain for a project
 */
export async function setCustomDomain(
  env: Env,
  projectName: string,
  domain: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  try {
    const teamQuery = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';

    const response = await fetch(
      `https://api.vercel.com/v10/projects/${projectName}/domains${teamQuery}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    const data = await response.json() as { error?: { message?: string } };

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Failed to set domain',
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get deployment status
 */
export async function getDeploymentStatus(
  env: Env,
  deploymentId: string
): Promise<{ status: string; url?: string; error?: string }> {
  if (!env.VERCEL_TOKEN) {
    return { status: 'error', error: 'VERCEL_TOKEN not configured' };
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}${env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${env.VERCEL_TOKEN}`,
        },
      }
    );

    const data = await response.json() as { readyState?: string; url?: string; error?: { message?: string } };

    if (!response.ok) {
      return {
        status: 'error',
        error: data.error?.message || 'Failed to get status',
      };
    }

    return {
      status: data.readyState || 'unknown',
      url: data.url ? `https://${data.url}` : undefined,
    };
  } catch (error) {
    return { status: 'error', error: String(error) };
  }
}
