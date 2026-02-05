/**
 * Neynar Notifications Service for Shipyard Mini App
 *
 * Notification schedule:
 * - Welcome: Sent when a user adds the mini app
 * - Daily Builder Highlight: 9am UTC - Top 3 builders of the week
 * - Featured Project: 3pm UTC - Daily featured project rotation
 * - Rug Alert: Real-time when new critical rug detected
 */

import { Env } from '../types';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';
const SHIPYARD_URL = 'https://shipyard.fixr.nexus';

interface NotificationPayload {
  targetUrl: string;
  title: string;
  body: string;
}

interface NeynarNotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send a notification to a specific user via Neynar
 */
export async function sendNotificationToUser(
  env: Env,
  fid: number,
  notification: NotificationPayload
): Promise<NeynarNotificationResponse> {
  if (!env.NEYNAR_API_KEY) {
    return { success: false, error: 'NEYNAR_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${NEYNAR_API_BASE}/farcaster/frame/notifications/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        target_fids: [fid],
        notification: {
          target_url: notification.targetUrl,
          title: notification.title,
          body: notification.body,
          uuid: crypto.randomUUID(),
        },
      }),
    });

    const data = await response.json() as { success?: boolean; message?: string };

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to send notification' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Send a notification to multiple users
 */
export async function sendBulkNotification(
  env: Env,
  fids: number[],
  notification: NotificationPayload
): Promise<NeynarNotificationResponse> {
  if (!env.NEYNAR_API_KEY) {
    return { success: false, error: 'NEYNAR_API_KEY not configured' };
  }

  if (fids.length === 0) {
    return { success: false, error: 'No FIDs provided' };
  }

  try {
    // Neynar may have a limit on bulk notifications, batch if needed
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < fids.length; i += batchSize) {
      batches.push(fids.slice(i, i + batchSize));
    }

    let totalSent = 0;
    for (const batch of batches) {
      const response = await fetch(`${NEYNAR_API_BASE}/farcaster/frame/notifications/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.NEYNAR_API_KEY,
        },
        body: JSON.stringify({
          target_fids: batch,
          notification: {
            target_url: notification.targetUrl,
            title: notification.title,
            body: notification.body,
            uuid: crypto.randomUUID(),
          },
        }),
      });

      if (response.ok) {
        totalSent += batch.length;
      }
    }

    return { success: true, message: `Sent to ${totalSent} users` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Send welcome notification to new user
 */
export async function sendWelcomeNotification(
  env: Env,
  fid: number,
  username?: string
): Promise<NeynarNotificationResponse> {
  return sendNotificationToUser(env, fid, {
    targetUrl: SHIPYARD_URL,
    title: 'Welcome to Shipyard!',
    body: username
      ? `Hey @${username}! Scan tokens, discover builders, explore shipped projects.`
      : 'Scan tokens, discover builders, and explore shipped projects.',
  });
}

/**
 * Send daily builder highlight notification
 */
export async function sendBuilderHighlightNotification(
  env: Env,
  fids: number[],
  topBuilders: { username: string; shippedCount: number }[]
): Promise<NeynarNotificationResponse> {
  // Body max 128 chars
  const builderList = topBuilders
    .slice(0, 3)
    .map((b, i) => `${i + 1}. @${b.username}`)
    .join(', ');

  return sendBulkNotification(env, fids, {
    targetUrl: `${SHIPYARD_URL}?view=builders`,
    title: 'Top Builders This Week',
    body: (builderList || 'Check out trending builders!').slice(0, 128),
  });
}

/**
 * Send featured project notification
 */
export async function sendFeaturedProjectNotification(
  env: Env,
  fids: number[],
  project: { name: string; description: string; submitterUsername: string }
): Promise<NeynarNotificationResponse> {
  // Title max 32 chars, body max 128 chars
  const title = `Featured: ${project.name}`.slice(0, 32);
  const body = `${project.description.slice(0, 80)} by @${project.submitterUsername}`.slice(0, 128);

  return sendBulkNotification(env, fids, {
    targetUrl: SHIPYARD_URL,
    title,
    body,
  });
}

/**
 * Send rug alert notification
 */
export async function sendRugAlertNotification(
  env: Env,
  fids: number[],
  incident: { tokenSymbol: string; rugType: string; severity: string }
): Promise<NeynarNotificationResponse> {
  const severityEmoji = incident.severity === 'critical' ? '' : incident.severity === 'confirmed' ? '' : '';

  return sendBulkNotification(env, fids, {
    targetUrl: `${SHIPYARD_URL}?view=rugs`,
    title: `${severityEmoji} Rug Alert: $${incident.tokenSymbol}`,
    body: `${incident.rugType.replace('_', ' ')} detected. Stay safe - check Shipyard for details.`,
  });
}

/**
 * Get list of users who have added the mini app (subscribed to notifications)
 * This queries our database for users who have interacted with the app
 */
export async function getNotificationSubscribers(env: Env): Promise<number[]> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/miniapp_users?select=fid&notifications_enabled=eq.true`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const users = await response.json() as { fid: number }[];
    return users.map(u => u.fid);
  } catch {
    return [];
  }
}

/**
 * Record a user as a mini app subscriber
 */
export async function recordMiniAppUser(
  env: Env,
  fid: number,
  username?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/miniapp_users`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          fid,
          username: username || null,
          notifications_enabled: true,
          added_at: new Date().toISOString(),
        }),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Process webhook event from Neynar
 */
export interface NeynarWebhookEvent {
  type: string;
  data: {
    fid?: number;
    user?: {
      fid: number;
      username: string;
    };
    event?: string;
  };
}

export async function processWebhookEvent(
  env: Env,
  event: NeynarWebhookEvent
): Promise<{ handled: boolean; action?: string }> {
  // Handle mini app add event
  if (event.type === 'frame_added' || event.data?.event === 'frame_added') {
    const fid = event.data?.user?.fid || event.data?.fid;
    const username = event.data?.user?.username;

    if (fid) {
      // Record the user
      await recordMiniAppUser(env, fid, username);

      // Send welcome notification
      await sendWelcomeNotification(env, fid, username);

      return { handled: true, action: 'welcome_sent' };
    }
  }

  // Handle mini app remove event
  if (event.type === 'frame_removed' || event.data?.event === 'frame_removed') {
    const fid = event.data?.user?.fid || event.data?.fid;

    if (fid) {
      // Update user to disable notifications
      try {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/miniapp_users?fid=eq.${fid}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notifications_enabled: false,
              removed_at: new Date().toISOString(),
            }),
          }
        );
      } catch {
        // Ignore errors
      }

      return { handled: true, action: 'user_unsubscribed' };
    }
  }

  return { handled: false };
}
