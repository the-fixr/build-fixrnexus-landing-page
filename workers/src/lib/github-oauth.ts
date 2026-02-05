// GitHub OAuth for User Repo Creation
// Allows builders to create repos in their own GitHub account

import { Env } from './types';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

export interface OAuthState {
  appName: string;
  primaryColor: string;
  features: string[];
  returnUrl: string;
}

// UTF-8 safe base64 encoder
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate the GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(
  env: Env,
  state: OAuthState,
  redirectUri: string
): string {
  if (!env.GITHUB_CLIENT_ID) {
    throw new Error('GITHUB_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo', // Need repo scope to create repos
    state: utf8ToBase64(JSON.stringify(state)),
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  env: Env,
  code: string
): Promise<{ access_token: string; token_type: string; scope: string } | null> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth not configured');
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    console.error('GitHub token exchange failed:', response.status);
    return null;
  }

  const data = await response.json() as Record<string, string>;

  if (data.error) {
    console.error('GitHub OAuth error:', data.error_description || data.error);
    return null;
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Get authenticated user info
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    console.error('Failed to get GitHub user:', response.status);
    return null;
  }

  return response.json() as Promise<GitHubUser>;
}

/**
 * Create a repo in the user's account with template files
 */
export async function createUserRepo(
  accessToken: string,
  repoName: string,
  description: string,
  files: Array<{ path: string; content: string }>
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  try {
    // 1. Create the repository
    const createResponse = await fetch(`${GITHUB_API_URL}/user/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description,
        private: false,
        auto_init: true, // Creates initial commit with README
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json() as { message?: string };
      return {
        success: false,
        error: error.message || `Failed to create repo: ${createResponse.status}`,
      };
    }

    const repo = await createResponse.json() as { html_url: string; full_name: string };
    const [owner, repoNameActual] = repo.full_name.split('/');

    // 2. Wait a moment for GitHub to initialize the repo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Get the default branch ref
    const refResponse = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/ref/heads/main`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!refResponse.ok) {
      // Try 'master' branch instead
      const masterRefResponse = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/ref/heads/master`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );
      if (!masterRefResponse.ok) {
        return {
          success: true,
          repoUrl: repo.html_url,
          error: 'Repo created but could not push files (no default branch found)',
        };
      }
    }

    const refData = await refResponse.json() as { object: { sha: string } };
    const currentCommitSha = refData.object.sha;

    // 4. Get the tree
    const commitResponse = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/commits/${currentCommitSha}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    const commitData = await commitResponse.json() as { tree: { sha: string } };
    const treeSha = commitData.tree.sha;

    // 5. Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blobResponse = await fetch(
          `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/blobs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: utf8ToBase64(file.content),
              encoding: 'base64',
            }),
          }
        );
        const blobData = await blobResponse.json() as { sha: string };
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );

    // 6. Create new tree
    const treeResponse = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_tree: treeSha,
          tree: blobs,
        }),
      }
    );
    const treeData = await treeResponse.json() as { sha: string };

    // 7. Create commit
    const newCommitResponse = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Initialize Farcaster mini app from Fixr template\n\nCreated with Shipyard Launchpad',
          tree: treeData.sha,
          parents: [currentCommitSha],
        }),
      }
    );
    const newCommitData = await newCommitResponse.json() as { sha: string };

    // 8. Update ref
    await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repoNameActual}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    return {
      success: true,
      repoUrl: repo.html_url,
    };
  } catch (error) {
    console.error('Error creating user repo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
