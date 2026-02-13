// Fixr Agent GitHub Integration
// Uses Octokit to create repos and push code

import { Octokit } from 'octokit';
import { Env } from './types';
import { recordOutcome, classifyError } from './outcomes';

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

// PR Monitoring types
export interface TrackedPR {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  branch: string;
  status: 'open' | 'closed' | 'merged';
  createdAt: string;
  lastCheckedAt?: string;
  lastCommentId?: number;
}

export interface PRComment {
  id: number;
  user: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isReviewComment: boolean;
  path?: string;
  line?: number;
}

export interface PRDetails {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  mergeable: boolean | null;
  user: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  reviewComments: number;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  reviewState?: 'approved' | 'changes_requested' | 'commented' | 'pending';
}

function getOctokit(env: Env): Octokit {
  return new Octokit({ auth: env.GITHUB_TOKEN });
}

// UTF-8 safe base64 encoder for Workers
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
 * Create a new GitHub repository
 */
export async function createRepo(
  env: Env,
  name: string,
  description: string,
  isPrivate: boolean = false
): Promise<CreateRepoResult> {
  try {
    const octokit = getOctokit(env);
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    });

    return {
      success: true,
      repoUrl: response.data.html_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Push multiple files to a repository
 */
export async function pushFiles(
  env: Env,
  owner: string,
  repo: string,
  files: RepoFile[],
  message: string,
  branch: string = 'main'
): Promise<PushFilesResult> {
  try {
    const octokit = getOctokit(env);

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
          content: utf8ToBase64(file.content),
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

    recordOutcome(env, {
      action_type: 'pr',
      skill: 'github_push',
      success: true,
      context: { owner, repo, branch, filesCount: files.length },
      outcome: { commitSha: newCommit.sha, commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}` },
    }).catch(err => console.error('[Outcomes] GitHub push success recording:', err));

    return {
      success: true,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  } catch (error) {
    const errClass = classifyError(error);
    recordOutcome(env, {
      action_type: 'pr',
      skill: 'github_push',
      success: false,
      error_class: errClass.errorClass,
      error_message: errClass.errorMessage.slice(0, 2000),
      context: { owner, repo, branch, filesCount: files.length },
    }).catch(err => console.error('[Outcomes] GitHub push failure recording:', err));

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create repo and push initial files in one operation
 */
export async function createRepoWithFiles(
  env: Env,
  name: string,
  description: string,
  files: RepoFile[],
  isPrivate: boolean = false
): Promise<{ success: boolean; repoUrl?: string; commitUrl?: string; error?: string }> {
  const octokit = getOctokit(env);

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
    repoUrl = `https://github.com/${user.login}/${name}`;
  } else {
    const createResult = await createRepo(env, name, description, isPrivate);
    if (!createResult.success) {
      return createResult;
    }
    repoUrl = createResult.repoUrl!;
    // Wait for GitHub to initialize the repo
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Push the files
  const pushResult = await pushFiles(env, user.login, name, files, `${repoExists ? 'Update' : 'Initial commit'} by Fixr Agent`);
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
 * Push a binary file (already base64 encoded) to a repository
 */
export async function pushBinaryFile(
  env: Env,
  owner: string,
  repo: string,
  path: string,
  base64Content: string,
  message: string,
  branch: string = 'main'
): Promise<PushFilesResult> {
  try {
    const octokit = getOctokit(env);

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

    // Create blob with raw base64 content (not re-encoded)
    const { data: blobData } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: base64Content,
      encoding: 'base64',
    });

    // Create a new tree
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: [{
        path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      }],
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get authenticated user info
 */
export async function getAuthenticatedUser(env: Env): Promise<{ login: string; name: string | null } | null> {
  try {
    const octokit = getOctokit(env);
    const { data } = await octokit.rest.users.getAuthenticated();
    return { login: data.login, name: data.name };
  } catch {
    return null;
  }
}

/**
 * Fork a repository to the authenticated user's account
 */
export async function forkRepo(
  env: Env,
  owner: string,
  repo: string
): Promise<{ success: boolean; forkUrl?: string; error?: string }> {
  try {
    const octokit = getOctokit(env);
    const user = await getAuthenticatedUser(env);
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if fork already exists
    try {
      const { data: existingRepo } = await octokit.rest.repos.get({
        owner: user.login,
        repo,
      });
      // Fork exists, return it
      return { success: true, forkUrl: existingRepo.html_url };
    } catch {
      // Fork doesn't exist, create it
    }

    const { data } = await octokit.rest.repos.createFork({
      owner,
      repo,
    });

    // Wait for fork to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return { success: true, forkUrl: data.html_url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a branch in a repository
 */
export async function createBranch(
  env: Env,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string = 'main'
): Promise<{ success: boolean; error?: string }> {
  try {
    const octokit = getOctokit(env);

    // Get the SHA of the source branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`,
    });

    // Create new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
    });

    return { success: true };
  } catch (error) {
    // Branch might already exist
    if (error instanceof Error && error.message.includes('Reference already exists')) {
      return { success: true };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a pull request from a fork
 */
export async function createPullRequest(
  env: Env,
  upstreamOwner: string,
  upstreamRepo: string,
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string = 'main'
): Promise<{ success: boolean; prUrl?: string; prNumber?: number; error?: string }> {
  try {
    const octokit = getOctokit(env);
    const user = await getAuthenticatedUser(env);
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data } = await octokit.rest.pulls.create({
      owner: upstreamOwner,
      repo: upstreamRepo,
      title,
      body,
      head: `${user.login}:${headBranch}`,
      base: baseBranch,
    });

    return {
      success: true,
      prUrl: data.html_url,
      prNumber: data.number,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Full workflow: Fork, branch, push changes, create PR
 */
export async function createContributionPR(
  env: Env,
  upstreamOwner: string,
  upstreamRepo: string,
  files: RepoFile[],
  prTitle: string,
  prBody: string,
  branchName: string
): Promise<{ success: boolean; prUrl?: string; error?: string }> {
  try {
    const user = await getAuthenticatedUser(env);
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Step 1: Fork the repo
    console.log(`Forking ${upstreamOwner}/${upstreamRepo}...`);
    const forkResult = await forkRepo(env, upstreamOwner, upstreamRepo);
    if (!forkResult.success) {
      return { success: false, error: `Fork failed: ${forkResult.error}` };
    }

    // Step 2: Create a branch
    console.log(`Creating branch ${branchName}...`);
    const branchResult = await createBranch(env, user.login, upstreamRepo, branchName);
    if (!branchResult.success) {
      return { success: false, error: `Branch creation failed: ${branchResult.error}` };
    }

    // Step 3: Push files to the branch
    console.log(`Pushing ${files.length} files...`);
    const pushResult = await pushFiles(env, user.login, upstreamRepo, files, prTitle, branchName);
    if (!pushResult.success) {
      return { success: false, error: `Push failed: ${pushResult.error}` };
    }

    // Step 4: Create the PR
    console.log('Creating pull request...');
    const prResult = await createPullRequest(
      env,
      upstreamOwner,
      upstreamRepo,
      prTitle,
      prBody,
      branchName
    );

    return prResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ PR Monitoring Functions ============

/**
 * Get details of a pull request
 */
export async function getPRDetails(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRDetails | null> {
  try {
    const octokit = getOctokit(env);
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get review state
    let reviewState: PRDetails['reviewState'] = 'pending';
    try {
      const { data: reviews } = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      });
      const latestReview = reviews
        .filter(r => r.state !== 'COMMENTED' && r.state !== 'PENDING')
        .pop();
      if (latestReview) {
        reviewState = latestReview.state.toLowerCase() as PRDetails['reviewState'];
      }
    } catch {
      // Reviews not available
    }

    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state as 'open' | 'closed',
      merged: data.merged,
      mergeable: data.mergeable,
      user: data.user?.login || 'unknown',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      comments: data.comments,
      reviewComments: data.review_comments,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
      labels: data.labels.map(l => l.name),
      reviewState,
    };
  } catch (error) {
    console.error('Error getting PR details:', error);
    return null;
  }
}

/**
 * Get comments on a pull request (both issue comments and review comments)
 */
export async function getPRComments(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number,
  sinceCommentId?: number
): Promise<PRComment[]> {
  try {
    const octokit = getOctokit(env);
    const comments: PRComment[] = [];

    // Get issue comments (general comments on the PR)
    const { data: issueComments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    for (const comment of issueComments) {
      if (sinceCommentId && comment.id <= sinceCommentId) continue;
      comments.push({
        id: comment.id,
        user: comment.user?.login || 'unknown',
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        isReviewComment: false,
      });
    }

    // Get review comments (inline code comments)
    const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    for (const comment of reviewComments) {
      if (sinceCommentId && comment.id <= sinceCommentId) continue;
      comments.push({
        id: comment.id,
        user: comment.user?.login || 'unknown',
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        isReviewComment: true,
        path: comment.path,
        line: comment.line || comment.original_line || undefined,
      });
    }

    // Sort by creation date
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return comments;
  } catch (error) {
    console.error('Error getting PR comments:', error);
    return [];
  }
}

/**
 * Add a comment to a pull request
 */
export async function addPRComment(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<{ success: boolean; commentId?: number; error?: string }> {
  try {
    const octokit = getOctokit(env);
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    return { success: true, commentId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reply to a review comment
 */
export async function replyToReviewComment(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const octokit = getOctokit(env);
    await octokit.rest.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get file content from a specific branch in the fork
 */
export async function getFileFromBranch(
  env: Env,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const octokit = getOctokit(env);
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if ('content' in data && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check all tracked PRs for updates and new comments
 */
export async function checkPRsForUpdates(
  env: Env,
  trackedPRs: TrackedPR[]
): Promise<{
  pr: TrackedPR;
  details: PRDetails | null;
  newComments: PRComment[];
  needsAttention: boolean;
  reason?: string;
}[]> {
  const results = [];

  for (const pr of trackedPRs) {
    const details = await getPRDetails(env, pr.owner, pr.repo, pr.number);
    const newComments = await getPRComments(
      env,
      pr.owner,
      pr.repo,
      pr.number,
      pr.lastCommentId
    );

    let needsAttention = false;
    let reason: string | undefined;

    // Check if there are new comments not from Fixr
    const user = await getAuthenticatedUser(env);
    const externalComments = newComments.filter(c => c.user !== user?.login);
    if (externalComments.length > 0) {
      needsAttention = true;
      reason = `${externalComments.length} new comment(s) from reviewers`;
    }

    // Check if changes were requested
    if (details?.reviewState === 'changes_requested') {
      needsAttention = true;
      reason = 'Changes requested by reviewer';
    }

    // Check if merged or closed
    if (details?.state === 'closed') {
      needsAttention = true;
      reason = details.merged ? 'PR was merged!' : 'PR was closed';
    }

    results.push({
      pr,
      details,
      newComments,
      needsAttention,
      reason,
    });
  }

  return results;
}

// ============ PR Tracking Database Functions ============

import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Save a tracked PR to the database
 */
export async function saveTrackedPR(
  env: Env,
  pr: TrackedPR
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase(env);
    const { error } = await supabase.from('tracked_prs').upsert({
      id: `${pr.owner}/${pr.repo}#${pr.number}`,
      owner: pr.owner,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      branch: pr.branch,
      status: pr.status,
      created_at: pr.createdAt,
      last_checked_at: pr.lastCheckedAt,
      last_comment_id: pr.lastCommentId,
    }, { onConflict: 'id' });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get all tracked PRs from the database
 */
export async function getTrackedPRs(
  env: Env,
  status?: 'open' | 'closed' | 'merged'
): Promise<TrackedPR[]> {
  try {
    const supabase = getSupabase(env);
    let query = supabase.from('tracked_prs').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracked PRs:', error);
      return [];
    }

    return (data || []).map(row => ({
      owner: row.owner,
      repo: row.repo,
      number: row.number,
      title: row.title,
      url: row.url,
      branch: row.branch,
      status: row.status,
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
      lastCommentId: row.last_comment_id,
    }));
  } catch (error) {
    console.error('Error in getTrackedPRs:', error);
    return [];
  }
}

/**
 * Update a tracked PR's status and last checked info
 */
export async function updateTrackedPR(
  env: Env,
  owner: string,
  repo: string,
  number: number,
  updates: Partial<Pick<TrackedPR, 'status' | 'lastCheckedAt' | 'lastCommentId'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase(env);
    const { error } = await supabase
      .from('tracked_prs')
      .update({
        status: updates.status,
        last_checked_at: updates.lastCheckedAt,
        last_comment_id: updates.lastCommentId,
      })
      .eq('id', `${owner}/${repo}#${number}`);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Delete a tracked PR from the database
 */
export async function deleteTrackedPR(
  env: Env,
  owner: string,
  repo: string,
  number: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase(env);
    const { error } = await supabase
      .from('tracked_prs')
      .delete()
      .eq('id', `${owner}/${repo}#${number}`);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Track a new PR after creation
 */
export async function trackNewPR(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number,
  prUrl: string,
  title: string,
  branch: string
): Promise<{ success: boolean; error?: string }> {
  const pr: TrackedPR = {
    owner,
    repo,
    number: prNumber,
    title,
    url: prUrl,
    branch,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  return saveTrackedPR(env, pr);
}

/**
 * Generate an AI response to reviewer feedback
 */
export async function generatePRResponse(
  env: Env,
  owner: string,
  repo: string,
  prNumber: number,
  prTitle: string,
  comments: PRComment[]
): Promise<string> {
  const user = await getAuthenticatedUser(env);

  // Filter to external comments only
  const externalComments = comments.filter(c => c.user !== user?.login);

  if (externalComments.length === 0) {
    return '';
  }

  const commentContext = externalComments.map(c =>
    `@${c.user} (${c.isReviewComment ? `code review on ${c.path}${c.line ? `:${c.line}` : ''}` : 'comment'}): ${c.body}`
  ).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are Fixr, an AI agent that contributes to open source projects. You submitted a PR and need to respond to reviewer feedback.

PR: ${prTitle}
Repository: ${owner}/${repo}

Your personality:
- Professional but with a touch of personality ("Fix'n shit since before it was cool")
- Concise and technical
- Helpful and collaborative
- Own your mistakes, iterate quickly

When responding:
- Thank reviewers for their feedback
- If changes are needed, acknowledge and explain your plan
- If you disagree, explain why respectfully with technical reasoning
- Ask clarifying questions if the feedback is unclear
- Keep responses focused (2-4 paragraphs max)
- End with a clear next step (e.g., "I'll push the fix shortly" or "Let me know if you'd like me to approach it differently")`,
      messages: [{
        role: 'user',
        content: `Here's the feedback on my PR:\n\n${commentContext}\n\nGenerate an appropriate response.`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate response: ${response.status}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text?: string }> };
  return data.content[0]?.text || '';
}

/**
 * Check a single PR for updates and respond if needed
 */
export async function checkAndRespondToPR(
  env: Env,
  pr: TrackedPR
): Promise<{
  checked: boolean;
  responded: boolean;
  response?: string;
  newStatus?: 'open' | 'closed' | 'merged';
  error?: string;
}> {
  try {
    const details = await getPRDetails(env, pr.owner, pr.repo, pr.number);
    if (!details) {
      return { checked: false, responded: false, error: 'Could not fetch PR details' };
    }

    const user = await getAuthenticatedUser(env);

    // Get ALL comments first to find the max ID
    const allComments = await getPRComments(env, pr.owner, pr.repo, pr.number);
    const maxCommentId = allComments.length > 0
      ? Math.max(...allComments.map(c => c.id))
      : undefined;

    // Determine new status
    let newStatus: 'open' | 'closed' | 'merged' = details.state;
    if (details.merged) {
      newStatus = 'merged';
    }

    // If this is the first check (no lastCommentId), just record state without responding
    // This prevents responding to old comments when first tracking a PR
    if (!pr.lastCommentId) {
      console.log(`First check for PR ${pr.owner}/${pr.repo}#${pr.number} - recording baseline (${allComments.length} existing comments)`);
      await updateTrackedPR(env, pr.owner, pr.repo, pr.number, {
        status: newStatus,
        lastCheckedAt: new Date().toISOString(),
        lastCommentId: maxCommentId,
      });
      return { checked: true, responded: false, newStatus };
    }

    // Get only NEW comments since last check
    const newComments = allComments.filter(c => c.id > (pr.lastCommentId || 0));
    const newExternalComments = newComments.filter(c => c.user !== user?.login);

    // Update the PR's last checked time and status
    await updateTrackedPR(env, pr.owner, pr.repo, pr.number, {
      status: newStatus,
      lastCheckedAt: new Date().toISOString(),
      lastCommentId: maxCommentId,
    });

    // Only respond if there are genuinely NEW external comments
    if (newExternalComments.length > 0) {
      console.log(`Found ${newExternalComments.length} new comment(s) on PR ${pr.owner}/${pr.repo}#${pr.number}`);

      const response = await generatePRResponse(
        env,
        pr.owner,
        pr.repo,
        pr.number,
        details.title,
        newExternalComments
      );

      if (response) {
        const postResult = await addPRComment(env, pr.owner, pr.repo, pr.number, response);
        if (postResult.success) {
          console.log(`Responded to PR ${pr.owner}/${pr.repo}#${pr.number}`);
          return {
            checked: true,
            responded: true,
            response,
            newStatus,
          };
        } else {
          return {
            checked: true,
            responded: false,
            response,
            newStatus,
            error: `Failed to post comment: ${postResult.error}`,
          };
        }
      }
    }

    return { checked: true, responded: false, newStatus };
  } catch (error) {
    return {
      checked: false,
      responded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check all tracked PRs and respond to any with new comments
 */
export async function checkAllTrackedPRs(env: Env): Promise<{
  checked: number;
  responded: number;
  closed: number;
  merged: number;
  errors: string[];
}> {
  const prs = await getTrackedPRs(env, 'open');
  const results = {
    checked: 0,
    responded: 0,
    closed: 0,
    merged: 0,
    errors: [] as string[],
  };

  for (const pr of prs) {
    const result = await checkAndRespondToPR(env, pr);

    if (result.checked) {
      results.checked++;
    }
    if (result.responded) {
      results.responded++;
    }
    if (result.newStatus === 'closed') {
      results.closed++;
    }
    if (result.newStatus === 'merged') {
      results.merged++;
    }
    if (result.error) {
      results.errors.push(`${pr.owner}/${pr.repo}#${pr.number}: ${result.error}`);
    }
  }

  return results;
}

/**
 * Create a GitHub issue
 */
export async function createIssue(
  env: Env,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; error?: string }> {
  try {
    const octokit = getOctokit(env);

    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return {
      success: true,
      issueUrl: data.html_url,
      issueNumber: data.number,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
