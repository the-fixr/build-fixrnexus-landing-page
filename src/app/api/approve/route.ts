// Fixr Agent Plan Approval Endpoint
// Handles approval/rejection of plans via email links

import { NextRequest, NextResponse } from 'next/server';
import { getApprovalRequest, updateApprovalRequest, updateTask, getTask } from '@/lib/memory';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const action = searchParams.get('action');

  if (!id || !action) {
    return new NextResponse(renderHtml('error', 'Missing id or action parameter'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (action !== 'approve' && action !== 'reject') {
    return new NextResponse(renderHtml('error', 'Invalid action'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    // Get the approval request
    const approvalRequest = await getApprovalRequest(id);

    if (!approvalRequest) {
      return new NextResponse(renderHtml('error', 'Approval request not found'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (approvalRequest.status !== 'pending') {
      return new NextResponse(
        renderHtml('info', `This plan has already been ${approvalRequest.status}`),
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Update approval request
    await updateApprovalRequest(id, action === 'approve' ? 'approved' : 'rejected');

    // Update task status
    const task = await getTask(approvalRequest.taskId);
    if (task) {
      if (action === 'approve') {
        await updateTask(task.id, {
          status: 'approved',
          plan: task.plan ? { ...task.plan, approvedAt: new Date().toISOString() } : undefined,
        });
      } else {
        await updateTask(task.id, {
          status: 'pending', // Reset to pending so a new plan can be generated
          plan: undefined,
        });
      }
    }

    const message =
      action === 'approve'
        ? 'Plan approved! Fixr will begin execution shortly.'
        : 'Plan rejected. Fixr will generate a new plan.';

    return new NextResponse(renderHtml('success', message, action), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Approval error:', error);
    return new NextResponse(renderHtml('error', String(error)), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderHtml(
  type: 'success' | 'error' | 'info',
  message: string,
  action?: string
): string {
  const colors = {
    success: { bg: '#1a2e1a', border: '#22c55e', text: '#22c55e' },
    error: { bg: '#2d1f1f', border: '#ef4444', text: '#ef4444' },
    info: { bg: '#1a1a2e', border: '#60a5fa', text: '#60a5fa' },
  };

  const c = colors[type];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Fixr Agent - ${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #0a0a0a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 400px;
            text-align: center;
          }
          .logo {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .tagline {
            color: #888;
            margin-bottom: 32px;
          }
          .card {
            background: ${c.bg};
            border: 1px solid ${c.border};
            border-radius: 12px;
            padding: 24px;
          }
          .card h2 {
            color: ${c.text};
            margin-bottom: 8px;
          }
          .card p {
            color: #ccc;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">FIXR</div>
          <p class="tagline">Fix'n shit. Debugging your mess since before it was cool.</p>
          <div class="card">
            <div class="icon">${type === 'success' ? (action === 'approve' ? '✓' : '↩') : type === 'error' ? '✕' : 'ℹ'}</div>
            <h2>${type === 'success' ? (action === 'approve' ? 'Approved' : 'Rejected') : type === 'error' ? 'Error' : 'Info'}</h2>
            <p>${message}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
