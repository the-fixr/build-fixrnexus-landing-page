// Fixr Agent Email System
// Uses Resend API for sending plan approval emails
// Adapted for Cloudflare Workers (uses fetch instead of Resend SDK)

import { Plan, Task, Env } from './types';

/**
 * Send email via Resend API
 */
async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Fixr Agent <${env.FROM_EMAIL || 'fixr@fixr.nexus'}>`,
        to,
        subject,
        html,
      }),
    });

    const data = await response.json() as { id?: string; error?: { message?: string } };

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function sendPlanApprovalEmail(
  env: Env,
  task: Task,
  plan: Plan
): Promise<{ success: boolean; id?: string; error?: string }> {
  const approvalUrl = `${env.APP_URL}/api/approve?id=${plan.id}&action=approve`;
  const rejectUrl = `${env.APP_URL}/api/approve?id=${plan.id}&action=reject`;

  const stepsHtml = plan.steps
    .map(
      (step, i) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #333; color: #888;">${i + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #333;">
          <span style="background: #333; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #888;">${step.action}</span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #333; color: #ccc;">${step.description}</td>
      </tr>
    `
    )
    .join('');

  const risksHtml = plan.risks.length
    ? `<div style="background: #2d1f1f; border: 1px solid #5c3030; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h4 style="color: #ff6b6b; margin: 0 0 8px 0;">Risks</h4>
        <ul style="margin: 0; padding-left: 20px; color: #ccc;">
          ${plan.risks.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Fixr Plan Approval</title>
      </head>
      <body style="background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #fff; margin: 0;">FIXR</h1>
            <p style="color: #888; margin: 8px 0 0 0;">Fix'n shit. Debugging your mess since before it was cool.</p>
          </div>

          <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #fff; margin: 0 0 8px 0;">New Plan Ready for Approval</h2>
            <p style="color: #888; margin: 0;">Task: <strong style="color: #fff;">${task.title}</strong></p>
          </div>

          <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #fff; margin: 0 0 16px 0;">Plan Summary</h3>
            <p style="color: #ccc; line-height: 1.6;">${plan.summary}</p>

            <h4 style="color: #888; margin: 24px 0 12px 0;">Steps</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333; color: #888; width: 40px;">#</th>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333; color: #888; width: 80px;">Type</th>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333; color: #888;">Description</th>
                </tr>
              </thead>
              <tbody>
                ${stepsHtml}
              </tbody>
            </table>

            <p style="color: #888; margin: 16px 0 0 0;">Estimated time: <strong style="color: #fff;">${plan.estimatedTime}</strong></p>
          </div>

          ${risksHtml}

          <div style="text-align: center; margin-top: 32px;">
            <a href="${approvalUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 0 8px;">Approve Plan</a>
            <a href="${rejectUrl}" style="display: inline-block; background: #333; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 0 8px;">Reject</a>
          </div>

          <p style="text-align: center; color: #666; margin-top: 32px; font-size: 12px;">
            This email was sent by Fixr Agent. Reply to provide feedback.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail(
    env,
    env.OWNER_EMAIL || 'see21289@gmail.com',
    `[Fixr] Plan ready: ${task.title}`,
    html
  );
}

export async function sendExecutionResultEmail(
  env: Env,
  task: Task,
  success: boolean,
  outputs: { type: string; url?: string }[]
): Promise<{ success: boolean; error?: string }> {
  const outputsHtml = outputs
    .map(
      (o) => `
      <li style="margin: 8px 0;">
        <span style="background: #333; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${o.type}</span>
        ${o.url ? `<a href="${o.url}" style="color: #60a5fa; margin-left: 8px;">${o.url}</a>` : ''}
      </li>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Fixr Execution Result</title>
      </head>
      <body style="background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #fff; margin: 0;">FIXR</h1>
          </div>

          <div style="background: ${success ? '#1a2e1a' : '#2d1f1f'}; border: 1px solid ${success ? '#22c55e' : '#ef4444'}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: ${success ? '#22c55e' : '#ef4444'}; margin: 0 0 8px 0;">
              ${success ? 'Task Completed' : 'Task Failed'}
            </h2>
            <p style="color: #ccc; margin: 0;">${task.title}</p>
          </div>

          ${
            outputs.length
              ? `
            <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 24px;">
              <h3 style="color: #fff; margin: 0 0 16px 0;">Outputs</h3>
              <ul style="margin: 0; padding-left: 20px; color: #ccc;">
                ${outputsHtml}
              </ul>
            </div>
          `
              : ''
          }

          <p style="text-align: center; color: #666; margin-top: 32px; font-size: 12px;">
            Fixr Agent
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail(
    env,
    env.OWNER_EMAIL || 'see21289@gmail.com',
    `[Fixr] ${success ? 'Done' : 'Failed'}: ${task.title}`,
    html
  );
}
