/**
 * WaveSpeedAI Video Generation Integration
 *
 * Uses Kling V2.6 Pro for high-quality AI video generation
 * Docs: https://wavespeed.ai/docs
 */

import { Env } from './types';

const WAVESPEED_API = 'https://api.wavespeed.ai/api/v3';

// Video generation models available
export const VIDEO_MODELS = {
  KLING_PRO_T2V: 'kwaivgi/kling-v2.6-pro/text-to-video',
  KLING_PRO_I2V: 'kwaivgi/kling-v2.6-pro/image-to-video',
  KLING_STD_T2V: 'kwaivgi/kling-v2.6-std/text-to-video',
} as const;

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: 5 | 10;
  cfgScale?: number;
  sound?: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface ImageToVideoRequest extends VideoGenerationRequest {
  imageUrl: string;
  endImageUrl?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  taskId?: string;
  status?: 'created' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  inferenceMs?: number;
}

/**
 * Submit a text-to-video generation task
 */
export async function generateVideoFromText(
  env: Env,
  request: VideoGenerationRequest
): Promise<VideoGenerationResult> {
  if (!env.WAVESPEED_API_KEY) {
    return { success: false, error: 'WaveSpeedAI API key not configured' };
  }

  try {
    console.log(`WaveSpeed: Generating video from prompt: "${request.prompt.slice(0, 50)}..."`);

    const response = await fetch(`${WAVESPEED_API}/${VIDEO_MODELS.KLING_PRO_T2V}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt: request.negativePrompt || 'watermark, text, logo, glitch, noisy audio, blurry, low quality',
        duration: request.duration || 5,
        cfg_scale: request.cfgScale || 0.5,
        sound: request.sound ?? true,
        aspect_ratio: request.aspectRatio || '16:9',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WaveSpeed API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      code: number;
      message: string;
      data: {
        id: string;
        status: string;
      };
    };

    if (data.code !== 200 && data.code !== 0) {
      return { success: false, error: data.message };
    }

    console.log(`WaveSpeed: Task created with ID: ${data.data.id}`);

    return {
      success: true,
      taskId: data.data.id,
      status: data.data.status as 'created' | 'processing',
    };
  } catch (error) {
    console.error('WaveSpeed generation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Submit an image-to-video generation task
 */
export async function generateVideoFromImage(
  env: Env,
  request: ImageToVideoRequest
): Promise<VideoGenerationResult> {
  if (!env.WAVESPEED_API_KEY) {
    return { success: false, error: 'WaveSpeedAI API key not configured' };
  }

  try {
    console.log(`WaveSpeed: Generating video from image`);

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      image: request.imageUrl,
      negative_prompt: request.negativePrompt || 'watermark, text, logo, glitch, noisy audio, blurry',
      duration: request.duration || 5,
      cfg_scale: request.cfgScale || 0.5,
    };

    // End image and sound cannot be used together
    if (request.endImageUrl) {
      body.end_image = request.endImageUrl;
      body.sound = false;
    } else {
      body.sound = request.sound ?? false;
    }

    const response = await fetch(`${WAVESPEED_API}/${VIDEO_MODELS.KLING_PRO_I2V}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WaveSpeed API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      code: number;
      message: string;
      data: {
        id: string;
        status: string;
      };
    };

    if (data.code !== 200 && data.code !== 0) {
      return { success: false, error: data.message };
    }

    return {
      success: true,
      taskId: data.data.id,
      status: data.data.status as 'created' | 'processing',
    };
  } catch (error) {
    console.error('WaveSpeed generation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Poll for video generation result
 */
export async function getVideoResult(
  env: Env,
  taskId: string
): Promise<VideoGenerationResult> {
  if (!env.WAVESPEED_API_KEY) {
    return { success: false, error: 'WaveSpeedAI API key not configured' };
  }

  try {
    const response = await fetch(`${WAVESPEED_API}/predictions/${taskId}/result`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.WAVESPEED_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WaveSpeed result fetch error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      code: number;
      message: string;
      data: {
        id: string;
        status: 'created' | 'processing' | 'completed' | 'failed';
        outputs?: string[];
        error?: string;
        timings?: {
          inference: number;
        };
      };
    };

    if (data.data.status === 'failed') {
      return {
        success: false,
        taskId,
        status: 'failed',
        error: data.data.error || 'Video generation failed',
      };
    }

    if (data.data.status === 'completed' && data.data.outputs?.[0]) {
      return {
        success: true,
        taskId,
        status: 'completed',
        videoUrl: data.data.outputs[0],
        inferenceMs: data.data.timings?.inference,
      };
    }

    return {
      success: true,
      taskId,
      status: data.data.status,
    };
  } catch (error) {
    console.error('WaveSpeed result fetch error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate video and wait for completion (with polling)
 * Max wait time: 3 minutes
 */
export async function generateVideoAndWait(
  env: Env,
  request: VideoGenerationRequest,
  maxWaitMs: number = 180000
): Promise<VideoGenerationResult> {
  // Start generation
  const startResult = await generateVideoFromText(env, request);
  if (!startResult.success || !startResult.taskId) {
    return startResult;
  }

  const taskId = startResult.taskId;
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  // Poll for result
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const result = await getVideoResult(env, taskId);

    if (result.status === 'completed' || result.status === 'failed') {
      return result;
    }

    console.log(`WaveSpeed: Task ${taskId} status: ${result.status}`);
  }

  return {
    success: false,
    taskId,
    status: 'processing',
    error: 'Timeout waiting for video generation',
  };
}

// ============================================================================
// VIDEO CONTENT TEMPLATES FOR FIXR
// ============================================================================

export interface VideoContentContext {
  type: 'weekly_recap' | 'builder_spotlight' | 'rug_alert' | 'trending_tokens';
  data: Record<string, unknown>;
}

/**
 * Generate a prompt for Fixr video content
 */
export function generateFixrVideoPrompt(context: VideoContentContext): string {
  switch (context.type) {
    case 'weekly_recap': {
      const { shippedCount, topBuilder, topTopic } = context.data as {
        shippedCount: number;
        topBuilder: string;
        topTopic: string;
      };
      return `Cinematic tech montage: A futuristic control room with holographic displays showing code and blockchain data. Camera slowly pushes in as glowing numbers "${shippedCount}" float prominently. Brief flashes of abstract builder silhouettes working. Text overlays appear: "This Week on Base" and "@${topBuilder}". Ends with the Fixr logo materializing from particles. Dark purple and cyan color palette. Ambient electronic music with subtle bass. Professional, sleek, tech-forward aesthetic.`;
    }

    case 'builder_spotlight': {
      const { username, projectName, projectType } = context.data as {
        username: string;
        projectName: string;
        projectType: string;
      };
      return `Developer spotlight video: Abstract visualization of a ${projectType} being built. Floating code blocks assembling into a glowing structure. Camera orbits around the creation. Username "@${username}" appears in modern typography. Project name "${projectName}" materializes with particle effects. Purple and blue gradient background with subtle grid lines. Inspirational ambient electronic soundtrack. Clean, modern, celebratory mood.`;
    }

    case 'rug_alert': {
      const { tokenSymbol, dropPercent } = context.data as {
        tokenSymbol: string;
        dropPercent: number;
      };
      return `Warning alert video: Dark red atmosphere with warning symbols flashing. A falling chart visualization shows dramatic decline. Token symbol "$${tokenSymbol}" appears with glitch effects. Numbers "-${dropPercent}%" displayed prominently with shake effect. Camera slowly zooms out revealing protective shield (representing Fixr). Ends with "Stay Safe" message. Tense, dramatic electronic music. Urgent but informative tone.`;
    }

    case 'trending_tokens': {
      const { tokens } = context.data as {
        tokens: Array<{ symbol: string; change: number }>;
      };
      const tokenList = tokens.slice(0, 3).map(t => `$${t.symbol}`).join(', ');
      return `Trending tokens visualization: Futuristic trading floor with holographic price charts. Camera pans across floating token symbols ${tokenList} with green upward arrows. Numbers and percentages animate dynamically. Sleek dark interface with neon accents. Ends with Fixr logo and "Trending on Base" text. Upbeat electronic music with positive energy. Professional financial aesthetic.`;
    }

    default:
      return 'Abstract blockchain visualization with glowing nodes and connections. Purple and blue color scheme. Ambient electronic music.';
  }
}

/**
 * Generate a weekly recap video for Fixr
 */
export async function generateWeeklyRecapVideo(
  env: Env,
  stats: {
    shippedCount: number;
    topBuilder: string;
    topTopic: string;
  }
): Promise<VideoGenerationResult> {
  const prompt = generateFixrVideoPrompt({
    type: 'weekly_recap',
    data: stats,
  });

  return generateVideoFromText(env, {
    prompt,
    duration: 5,
    sound: true,
    aspectRatio: '16:9',
  });
}
