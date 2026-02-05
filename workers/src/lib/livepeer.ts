/**
 * Livepeer Video Hosting Integration
 *
 * Upload videos to Livepeer for hosting and embed-friendly playback URLs.
 * Docs: https://docs.livepeer.org/api-reference/asset/upload
 */

import { Env } from './types';

const LIVEPEER_API = 'https://livepeer.studio/api';

export interface UploadResult {
  success: boolean;
  assetId?: string;
  playbackId?: string;
  playbackUrl?: string;
  error?: string;
}

export interface AssetStatus {
  success: boolean;
  status?: 'waiting' | 'processing' | 'ready' | 'failed';
  playbackId?: string;
  playbackUrl?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Request an upload URL from Livepeer
 */
export async function requestUploadUrl(
  env: Env,
  name: string
): Promise<{ success: boolean; uploadUrl?: string; assetId?: string; error?: string }> {
  if (!env.LIVEPEER_API_KEY) {
    return { success: false, error: 'Livepeer API key not configured' };
  }

  try {
    const response = await fetch(`${LIVEPEER_API}/asset/request-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        staticMp4: true, // Generate MP4 for direct download
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Livepeer request-upload error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      url: string;
      asset: { id: string };
    };

    return {
      success: true,
      uploadUrl: data.url,
      assetId: data.asset.id,
    };
  } catch (error) {
    console.error('Livepeer request-upload error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Upload video from URL to Livepeer
 */
export async function uploadVideoFromUrl(
  env: Env,
  videoUrl: string,
  name: string
): Promise<UploadResult> {
  if (!env.LIVEPEER_API_KEY) {
    return { success: false, error: 'Livepeer API key not configured' };
  }

  try {
    console.log(`Livepeer: Uploading video from URL: ${videoUrl}`);

    // First, fetch the video content
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return { success: false, error: `Failed to fetch video: ${videoResponse.status}` };
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    console.log(`Livepeer: Fetched video, size: ${videoBuffer.byteLength} bytes`);

    // Request upload URL
    const uploadRequest = await requestUploadUrl(env, name);
    if (!uploadRequest.success || !uploadRequest.uploadUrl) {
      return { success: false, error: uploadRequest.error || 'Failed to get upload URL' };
    }

    // Upload the video directly
    const uploadResponse = await fetch(uploadRequest.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Livepeer upload error:', uploadResponse.status, errorText);
      return { success: false, error: `Upload error: ${uploadResponse.status}` };
    }

    console.log(`Livepeer: Upload complete, asset ID: ${uploadRequest.assetId}`);

    return {
      success: true,
      assetId: uploadRequest.assetId,
    };
  } catch (error) {
    console.error('Livepeer upload error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get asset status and playback URL
 */
export async function getAssetStatus(
  env: Env,
  assetId: string
): Promise<AssetStatus> {
  if (!env.LIVEPEER_API_KEY) {
    return { success: false, error: 'Livepeer API key not configured' };
  }

  try {
    const response = await fetch(`${LIVEPEER_API}/asset/${assetId}`, {
      headers: {
        'Authorization': `Bearer ${env.LIVEPEER_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Livepeer get asset error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      status: { phase: string };
      playbackId?: string;
      downloadUrl?: string;
    };

    const status = data.status.phase as AssetStatus['status'];

    // Construct playback URL if ready
    let playbackUrl: string | undefined;
    if (data.playbackId && status === 'ready') {
      playbackUrl = `https://lvpr.tv/?v=${data.playbackId}`;
    }

    return {
      success: true,
      status,
      playbackId: data.playbackId,
      playbackUrl,
      downloadUrl: data.downloadUrl,
    };
  } catch (error) {
    console.error('Livepeer get asset error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Upload video and wait for processing to complete
 */
export async function uploadVideoAndWait(
  env: Env,
  videoUrl: string,
  name: string,
  maxWaitMs: number = 120000
): Promise<UploadResult> {
  // Upload the video
  const uploadResult = await uploadVideoFromUrl(env, videoUrl, name);
  if (!uploadResult.success || !uploadResult.assetId) {
    return uploadResult;
  }

  const assetId = uploadResult.assetId;
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  // Poll for completion
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const status = await getAssetStatus(env, assetId);

    if (status.status === 'ready') {
      return {
        success: true,
        assetId,
        playbackId: status.playbackId,
        playbackUrl: status.playbackUrl,
      };
    }

    if (status.status === 'failed') {
      return {
        success: false,
        assetId,
        error: 'Video processing failed',
      };
    }

    console.log(`Livepeer: Asset ${assetId} status: ${status.status}`);
  }

  return {
    success: false,
    assetId,
    error: 'Timeout waiting for video processing',
  };
}
