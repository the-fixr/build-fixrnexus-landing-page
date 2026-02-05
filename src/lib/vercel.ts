// Fixr Agent Vercel Deployment Integration
import { createHash } from 'crypto';

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

function getVercelToken() {
  return process.env.VERCEL_TOKEN;
}

function getVercelTeamId() {
  return process.env.VERCEL_TEAM_ID;
}

/**
 * Deploy files directly to Vercel using their file upload API
 */
export async function deployToVercel(
  projectName: string,
  files: DeploymentFile[]
): Promise<DeployResult> {
  const VERCEL_TOKEN = getVercelToken();
  if (!VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  const VERCEL_TEAM_ID = getVercelTeamId();

  try {
    // Step 1: Upload each file and get SHA hashes
    const uploadedFiles: { file: string; sha: string; size: number }[] = [];

    for (const f of files) {
      const content = Buffer.from(f.data, 'base64');
      const sha = createHash('sha1').update(content).digest('hex');

      // Upload file to personal account
      const uploadUrl = 'https://api.vercel.com/v2/files';
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'x-vercel-digest': sha,
        },
        body: content,
      });

      if (!uploadResponse.ok && uploadResponse.status !== 409) {
        // 409 means file already exists, which is fine
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
        size: content.length,
      });
    }

    // Step 2: Create deployment with file references
    // Deploy to personal account (no team) to avoid SSO protection issues
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
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

    const data = await response.json();

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
  repoUrl: string,
  projectName: string
): Promise<DeployResult> {
  const VERCEL_TOKEN = getVercelToken();
  const VERCEL_TEAM_ID = getVercelTeamId();

  if (!VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  try {
    // First, create/get the project
    const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        gitRepository: {
          type: 'github',
          repo: repoUrl.replace('https://github.com/', ''),
        },
        framework: 'nextjs',
        ...(VERCEL_TEAM_ID ? { teamId: VERCEL_TEAM_ID } : {}),
      }),
    });

    const projectData = await projectResponse.json();

    if (!projectResponse.ok && projectData.error?.code !== 'project_already_exists') {
      return {
        success: false,
        error: projectData.error?.message || 'Failed to create project',
      };
    }

    // Trigger a deployment
    const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        gitSource: {
          type: 'github',
          repoId: projectData.link?.repoId || projectData.id,
          ref: 'main',
        },
        target: 'production',
        ...(VERCEL_TEAM_ID ? { teamId: VERCEL_TEAM_ID } : {}),
      }),
    });

    const deployData = await deployResponse.json();

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
  projectName: string,
  domain: string
): Promise<{ success: boolean; error?: string }> {
  const VERCEL_TOKEN = getVercelToken();
  const VERCEL_TEAM_ID = getVercelTeamId();

  if (!VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v10/projects/${projectName}/domains`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: domain,
          ...(VERCEL_TEAM_ID ? { teamId: VERCEL_TEAM_ID } : {}),
        }),
      }
    );

    const data = await response.json();

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
  deploymentId: string
): Promise<{ status: string; url?: string; error?: string }> {
  const VERCEL_TOKEN = getVercelToken();
  const VERCEL_TEAM_ID = getVercelTeamId();

  if (!VERCEL_TOKEN) {
    return { status: 'error', error: 'VERCEL_TOKEN not configured' };
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        status: 'error',
        error: data.error?.message || 'Failed to get status',
      };
    }

    return {
      status: data.readyState, // QUEUED, BUILDING, READY, ERROR
      url: data.url ? `https://${data.url}` : undefined,
    };
  } catch (error) {
    return { status: 'error', error: String(error) };
  }
}
