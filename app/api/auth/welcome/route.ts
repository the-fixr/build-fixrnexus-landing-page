import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, username } = await request.json();

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@feeds.review',
      to: email,
      subject: 'Welcome to FEEDS - Decentralized Oracle Network',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: 'Courier New', monospace;
                background-color: #000000;
                color: #ffffff;
                padding: 40px;
                margin: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                border: 2px solid #333;
                padding: 40px;
                background-color: #000000;
              }
              .header {
                border-bottom: 2px solid #FF006E;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .title {
                font-size: 24px;
                font-weight: bold;
                margin: 0;
                color: #FF006E;
              }
              .subtitle {
                font-size: 12px;
                color: #666;
                margin: 5px 0 0 0;
              }
              .content {
                line-height: 1.8;
                color: #ccc;
              }
              .highlight {
                color: #FF006E;
                font-weight: bold;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #333;
                font-size: 12px;
                color: #666;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #FF006E;
                color: #ffffff;
                text-decoration: none;
                font-weight: bold;
                margin: 20px 0;
                border: 2px solid #FF006E;
              }
              .status-line {
                display: flex;
                align-items: center;
                margin: 10px 0;
                font-size: 14px;
              }
              .status-label {
                color: #666;
                margin-right: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 class="title">FEEDS</h1>
                <p class="subtitle">DECENTRALIZED CONSENSUS</p>
              </div>

              <div class="content">
                <p>Welcome to the network, <span class="highlight">${username || 'operator'}</span>!</p>

                <div style="margin: 30px 0;">
                  <div class="status-line">
                    <span class="status-label">&gt; STATUS:</span>
                    <span class="highlight">ACCOUNT CREATED</span>
                  </div>
                  <div class="status-line">
                    <span class="status-label">&gt; NETWORK:</span>
                    <span>BASE_MAINNET</span>
                  </div>
                  <div class="status-line">
                    <span class="status-label">&gt; ACCESS LEVEL:</span>
                    <span>FULL</span>
                  </div>
                </div>

                <p>Your account has been successfully created on the FEEDS decentralized oracle network.</p>

                <p><strong>What's next?</strong></p>
                <ul style="color: #ccc; line-height: 2;">
                  <li>Connect your wallet to get started</li>
                  <li>Configure your first oracle using AI</li>
                  <li>Join the consensus network</li>
                  <li>Start tracking real-time data feeds</li>
                </ul>

                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" class="button">
                  LAUNCH DASHBOARD
                </a>

                <p style="margin-top: 30px;">Need help? Check out our documentation or reach out to the community.</p>
              </div>

              <div class="footer">
                <p>FEEDS - Decentralized Oracle Network on Base</p>
                <p style="margin-top: 10px;">&gt; NETWORK ACTIVE | OPERATORS ONLINE | BASE CONNECTED</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Welcome email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
