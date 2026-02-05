// Fixr Agent GitHub Integration
// Uses Octokit to create repos and push code

import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export interface RepoFile {
  path: string;
  content: string;
}

export interface CreateRepoResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

export interface PushFilesResult {
  success: boolean;
  commitUrl?: string;
  error?: string;
}

/**
 * Create a new GitHub repository
 */
export async function createRepo(
  name: string,
  description: string,
  isPrivate: boolean = false
): Promise<CreateRepoResult> {
  try {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true, // Create with README
    });

    return {
      success: true,
      repoUrl: response.data.html_url,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Push multiple files to a repository
 */
export async function pushFiles(
  owner: string,
  repo: string,
  files: RepoFile[],
  message: string,
  branch: string = 'main'
): Promise<PushFilesResult> {
  try {
    // Get the current commit SHA for the branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const currentCommitSha = refData.object.sha;

    // Get the tree SHA
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });
    const treeSha = commitData.tree.sha;

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: data.sha,
        };
      })
    );

    // Create a new tree
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: blobs,
    });

    // Create the commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Update the reference
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      success: true,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Create repo and push initial files in one operation
 */
export async function createRepoWithFiles(
  name: string,
  description: string,
  files: RepoFile[],
  isPrivate: boolean = false
): Promise<{ success: boolean; repoUrl?: string; commitUrl?: string; error?: string }> {
  // Get the authenticated user first
  const { data: user } = await octokit.rest.users.getAuthenticated();

  // Check if repo exists
  let repoExists = false;
  try {
    await octokit.rest.repos.get({ owner: user.login, repo: name });
    repoExists = true;
  } catch {
    repoExists = false;
  }

  let repoUrl: string;

  if (repoExists) {
    // Repo exists, just use it
    repoUrl = `https://github.com/${user.login}/${name}`;
  } else {
    // Create the repo
    const createResult = await createRepo(name, description, isPrivate);
    if (!createResult.success) {
      return createResult;
    }
    repoUrl = createResult.repoUrl!;
    // Wait a moment for GitHub to initialize the repo
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Push the files
  const pushResult = await pushFiles(user.login, name, files, `${repoExists ? 'Update' : 'Initial commit'} by Fixr Agent`);
  if (!pushResult.success) {
    return { ...pushResult, repoUrl };
  }

  return {
    success: true,
    repoUrl,
    commitUrl: pushResult.commitUrl,
  };
}

/**
 * Get authenticated user info
 */
export async function getAuthenticatedUser(): Promise<{ login: string; name: string | null } | null> {
  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    return { login: data.login, name: data.name };
  } catch {
    return null;
  }
}
