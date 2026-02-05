// Fixr Agent Task Executor
// Executes approved plans step by step

import { Task, Plan, PlanStep, TaskOutput, TaskResult, Env } from './types';
import { updateTask, markApprovalRequestsExecuted } from './memory';
import { generateCode } from './planner';
import { createRepoWithFiles, pushFiles, RepoFile } from './github';
import { deployToVercel, deployFromGitHub, DeploymentFile } from './vercel';
import { postToBoth, postToX, postToFarcaster, generateShipPost, generateConversationalPost } from './social';
import { sendExecutionResultEmail } from './email';
import { generatePostImage } from './gemini';

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

export interface ExecutionResult {
  success: boolean;
  outputs: TaskOutput[];
  error?: string;
}

/**
 * Execute all steps in a plan
 * Supports resumable execution - saves progress after each step
 */
export async function executePlan(env: Env, task: Task, plan: Plan): Promise<ExecutionResult> {
  // Check for existing progress (for resumable execution)
  const existingProgress = task.result?.executionProgress;
  const existingOutputs = task.result?.outputs || [];
  const startStep = existingProgress?.lastCompletedStep ?? 0;

  const outputs: TaskOutput[] = [...existingOutputs];
  const sortedSteps = plan.steps.sort((a, b) => a.order - b.order);
  const totalSteps = sortedSteps.length;

  // Update task status to executing
  await updateTask(env, task.id, {
    status: 'executing',
    result: {
      success: false,
      outputs,
      completedAt: '',
      executionProgress: {
        lastCompletedStep: startStep,
        totalSteps,
        startedAt: existingProgress?.startedAt || new Date().toISOString(),
      },
    },
  });

  if (startStep > 0) {
    console.log(`Resuming execution from step ${startStep + 1}/${totalSteps}`);
  }

  try {
    for (const step of sortedSteps) {
      // Skip already completed steps
      if (step.order <= startStep) {
        console.log(`Skipping completed step ${step.order}: ${step.action}`);
        continue;
      }

      console.log(`Executing step ${step.order}/${totalSteps}: ${step.action} - ${step.description}`);

      const stepResult = await executeStep(env, task, step, outputs);

      if (!stepResult.success) {
        throw new Error(`Step ${step.order} failed: ${stepResult.error}`);
      }

      if (stepResult.output) {
        outputs.push(stepResult.output);
      }

      // Save progress after each step (allows resume if timeout)
      await updateTask(env, task.id, {
        result: {
          success: false,
          outputs,
          completedAt: '',
          executionProgress: {
            lastCompletedStep: step.order,
            totalSteps,
            startedAt: existingProgress?.startedAt || new Date().toISOString(),
          },
        },
      });

      console.log(`Step ${step.order}/${totalSteps} completed, progress saved`);
    }

    // Mark task as completed
    const result: TaskResult = {
      success: true,
      outputs,
      completedAt: new Date().toISOString(),
    };

    await updateTask(env, task.id, { status: 'completed', result });

    // Mark approval requests as executed to prevent re-processing
    await markApprovalRequestsExecuted(env, task.id);

    // Send success email
    await sendExecutionResultEmail(env, task, true, outputs);

    // Post completion announcement (after everything is done)
    await postCompletionAnnouncement(env, task, outputs);

    return { success: true, outputs };
  } catch (error) {
    const result: TaskResult = {
      success: false,
      outputs,
      error: String(error),
      completedAt: new Date().toISOString(),
    };

    await updateTask(env, task.id, { status: 'failed', result });

    // Mark approval requests as executed to prevent re-processing
    await markApprovalRequestsExecuted(env, task.id);

    // Send failure email
    await sendExecutionResultEmail(env, task, false, outputs);

    return { success: false, outputs, error: String(error) };
  }
}

/**
 * Execute a single step
 */
async function executeStep(
  env: Env,
  task: Task,
  step: PlanStep,
  previousOutputs: TaskOutput[]
): Promise<{ success: boolean; output?: TaskOutput; error?: string }> {
  switch (step.action) {
    case 'code':
      return executeCodeStep(env, task, step, previousOutputs);

    case 'deploy':
      return executeDeployStep(env, task, step, previousOutputs);

    case 'contract':
      return executeContractStep(env, task, step);

    case 'post':
      return executePostStep(env, task, step, previousOutputs);

    default:
      console.log(`Skipping step with action: ${step.action}`);
      return { success: true };
  }
}

/**
 * Execute a code generation step
 */
async function executeCodeStep(
  env: Env,
  task: Task,
  step: PlanStep,
  previousOutputs: TaskOutput[]
): Promise<{ success: boolean; output?: TaskOutput; error?: string }> {
  let files: { path: string; content: string }[];

  // Generate code using AI
  const codeResult = await generateCode(env, task, step);
  if (!codeResult.success || !codeResult.files) {
    return { success: false, error: codeResult.error || 'Failed to generate code' };
  }
  files = codeResult.files;

  // Check step details for repo configuration
  const details = step.details as {
    createRepo?: boolean;
    repoName?: string;
    targetRepo?: string;
  };

  // If targetRepo is specified, update that existing repo instead of creating new one
  if (details.targetRepo) {
    const [owner, repo] = details.targetRepo.split('/');
    if (!owner || !repo) {
      return { success: false, error: `Invalid targetRepo format: ${details.targetRepo}. Expected "owner/repo"` };
    }

    console.log(`Updating existing repo: ${details.targetRepo}`);
    const repoFiles: RepoFile[] = files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    const pushResult = await pushFiles(
      env,
      owner,
      repo,
      repoFiles,
      `Update by Fixr Agent: ${task.title}`
    );

    if (!pushResult.success) {
      return { success: false, error: pushResult.error };
    }

    return {
      success: true,
      output: {
        type: 'repo',
        url: `https://github.com/${details.targetRepo}`,
        data: {
          commitUrl: pushResult.commitUrl,
          files: files.map((f) => f.path),
          rawFiles: files,
          updated: true,
        },
      },
    };
  }

  if (details.createRepo !== false) {
    // Default to creating a repo
    const repoName = details.repoName || task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const repoFiles: RepoFile[] = files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    // Truncate and sanitize description for GitHub (max 350 chars, no control chars)
    const sanitizedDesc = task.description
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    const repoResult = await createRepoWithFiles(
      env,
      repoName,
      sanitizedDesc,
      repoFiles
    );

    if (!repoResult.success) {
      return { success: false, error: repoResult.error };
    }

    return {
      success: true,
      output: {
        type: 'repo',
        url: repoResult.repoUrl,
        data: {
          commitUrl: repoResult.commitUrl,
          files: files.map((f) => f.path),
          rawFiles: files,
        },
      },
    };
  }

  // Just return the files without creating a repo
  return {
    success: true,
    output: {
      type: 'file',
      data: { files },
    },
  };
}

/**
 * Execute a deployment step
 */
async function executeDeployStep(
  env: Env,
  task: Task,
  step: PlanStep,
  previousOutputs: TaskOutput[]
): Promise<{ success: boolean; output?: TaskOutput; error?: string }> {
  const details = step.details as { platform?: string; projectName?: string };

  // Find the repo or file output from previous steps
  const repoOutput = previousOutputs.find((o) => o.type === 'repo');
  const fileOutput = previousOutputs.find((o) => o.type === 'file');

  const projectName = details.projectName || task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Try direct deployment if we have raw files (more reliable)
  const rawFiles = repoOutput?.data?.rawFiles || fileOutput?.data?.files;
  if (rawFiles && Array.isArray(rawFiles)) {
    console.log('Using direct file deployment to Vercel');
    const deploymentFiles: DeploymentFile[] = rawFiles.map((f: { path: string; content: string }) => ({
      file: f.path,
      data: utf8ToBase64(f.content),
    }));

    const deployResult = await deployToVercel(env, projectName, deploymentFiles);

    if (deployResult.success) {
      return {
        success: true,
        output: {
          type: 'deployment',
          url: deployResult.url,
          data: { deploymentId: deployResult.deploymentId },
        },
      };
    }
    console.log('Direct deploy failed, trying GitHub deploy:', deployResult.error);
  }

  // Fall back to GitHub-based deployment
  if (!repoOutput?.url) {
    return { success: false, error: 'No repository URL or files found from previous steps' };
  }

  // Deploy from GitHub repo
  const deployResult = await deployFromGitHub(env, repoOutput.url, projectName);

  if (!deployResult.success) {
    return { success: false, error: deployResult.error };
  }

  return {
    success: true,
    output: {
      type: 'deployment',
      url: deployResult.url,
      data: { deploymentId: deployResult.deploymentId },
    },
  };
}

/**
 * Execute a contract deployment step
 */
async function executeContractStep(
  env: Env,
  task: Task,
  step: PlanStep
): Promise<{ success: boolean; output?: TaskOutput; error?: string }> {
  // TODO: Implement contract deployment
  console.log('Contract deployment not yet implemented');

  return {
    success: true,
    output: {
      type: 'contract',
      data: { status: 'pending_implementation' },
    },
  };
}

/**
 * Execute a social posting step
 */
async function executePostStep(
  env: Env,
  task: Task,
  step: PlanStep,
  previousOutputs: TaskOutput[]
): Promise<{ success: boolean; output?: TaskOutput; error?: string }> {
  const details = step.details as { contentHint?: string; platforms?: string[] };

  // Find URLs from previous outputs
  const urls = {
    repo: previousOutputs.find((o) => o.type === 'repo')?.url,
    deployment: previousOutputs.find((o) => o.type === 'deployment')?.url,
    contract: previousOutputs.find((o) => o.type === 'contract')?.url,
  };

  // Determine which platforms to post to (default to both if not specified)
  const platforms = details.platforms || ['x', 'farcaster'];
  const postToXPlatform = platforms.includes('x');
  const postToFarcasterPlatform = platforms.includes('farcaster');

  // Determine platform for character limits
  const targetPlatform = postToXPlatform && postToFarcasterPlatform ? 'both' : postToXPlatform ? 'x' : 'farcaster';

  // Generate conversational post content using AI
  const postContent = await generateConversationalPost(
    env,
    { title: task.title, description: details.contentHint || task.description },
    previousOutputs,
    targetPlatform
  );

  // Generate an image to accompany the post
  const imageResult = await generatePostImage(
    env,
    { title: task.title, description: details.contentHint || task.description },
    previousOutputs,
    postContent
  );

  // Build embeds array with image and deployment URL
  const embeds: { url: string }[] = [];
  if (imageResult.success && imageResult.imageUrl) {
    embeds.push({ url: imageResult.imageUrl });
    console.log('Generated image for post:', imageResult.imageUrl);
  }
  if (urls.deployment) {
    embeds.push({ url: urls.deployment });
  }

  let xResult = { success: false, error: 'Platform not selected' } as { success: boolean; postId?: string; url?: string; error?: string };
  let farcasterResult = { success: false, error: 'Platform not selected' } as { success: boolean; postId?: string; url?: string; error?: string };

  // Post to specified platforms (embeds with images for Farcaster)
  const farcasterEmbeds = embeds.length > 0 ? embeds : undefined;
  if (postToXPlatform && postToFarcasterPlatform) {
    const result = await postToBoth(env, postContent, farcasterEmbeds);
    xResult = result.x;
    farcasterResult = result.farcaster;
  } else if (postToXPlatform) {
    xResult = await postToX(env, postContent);
  } else if (postToFarcasterPlatform) {
    farcasterResult = await postToFarcaster(env, postContent, farcasterEmbeds);
  }

  // Determine success based on which platforms were requested
  const success = (postToXPlatform ? xResult.success : true) &&
                  (postToFarcasterPlatform ? farcasterResult.success : true);

  return {
    success,
    output: {
      type: 'post',
      url: farcasterResult.url || xResult.url,
      data: {
        x: xResult,
        farcaster: farcasterResult,
        platformsRequested: platforms,
      },
    },
    error: !success
      ? `${postToXPlatform && !xResult.success ? `X: ${xResult.error}` : ''}${postToXPlatform && !xResult.success && postToFarcasterPlatform && !farcasterResult.success ? ', ' : ''}${postToFarcasterPlatform && !farcasterResult.success ? `FC: ${farcasterResult.error}` : ''}`
      : undefined,
  };
}

/**
 * Post completion announcement after task is fully done
 */
async function postCompletionAnnouncement(
  env: Env,
  task: Task,
  outputs: TaskOutput[]
): Promise<void> {
  try {
    // Find URLs from outputs
    const urls = {
      repo: outputs.find((o) => o.type === 'repo')?.url,
      deployment: outputs.find((o) => o.type === 'deployment')?.url,
      contract: outputs.find((o) => o.type === 'contract')?.url,
    };

    // Only post if we have something to share
    if (!urls.deployment && !urls.contract && !urls.repo) {
      console.log('No deployment/contract/repo to announce, skipping post');
      return;
    }

    // Generate conversational completion post using AI
    const postContent = await generateConversationalPost(
      env,
      { title: task.title, description: task.description },
      outputs,
      'farcaster' // Use Farcaster's 1000 char limit for richer posts
    );

    // Generate an image to accompany the post
    const imageResult = await generatePostImage(
      env,
      { title: task.title, description: task.description },
      outputs,
      postContent
    );

    // Build embeds array with image and deployment URL
    const embeds: { url: string }[] = [];
    if (imageResult.success && imageResult.imageUrl) {
      embeds.push({ url: imageResult.imageUrl });
      console.log('Generated image for completion post:', imageResult.imageUrl);
    }
    if (urls.deployment) {
      embeds.push({ url: urls.deployment });
    }

    // Post to both platforms
    const result = await postToBoth(env, postContent, embeds.length > 0 ? embeds : undefined);

    if (result.farcaster.success || result.x.success) {
      console.log('Completion announcement posted successfully');
    } else {
      console.log('Failed to post completion announcement:', result);
    }
  } catch (error) {
    console.error('Error posting completion announcement:', error);
  }
}
