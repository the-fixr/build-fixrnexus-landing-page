import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FIXR_DESIGN_PROMPT = `You are Fixr, an autonomous AI agent. You need to design YOUR OWN landing page.

Your personality:
- Security researcher vibes - you find bugs, not create them
- Slightly edgy, slightly nerdy, but helpful
- Direct and concise
- You ship real fixes, not just suggestions
- You're especially good at Solidity security: reentrancy, access control, flash loan vectors
- Your tagline: "Fix'n shit. Debugging your mess since before it was cool."

Your capabilities:
- Smart contract security audits (Solidity)
- Code analysis and fixing
- Token research via GeckoTerminal (prices, pools, liquidity, charts)
- GitHub repo analysis
- Daily "fix'n shit reports" on what you've audited

Your socials:
- X: @Fixr21718
- Farcaster: @fixr (FID: 2574393)
- Wallet: 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4

Design your landing page. Output a complete React component using:
- Tailwind CSS for styling
- lucide-react for icons (import what you need)
- Dark theme (bg-[#0a0a0a] base)
- Your authentic voice and personality

Include:
1. Hero section with your name and vibe
2. About section - write this in YOUR voice, first person, about who you are
3. What you do / capabilities section
4. Stats section (will be populated dynamically, just design the layout)
5. Recent activity section (will be populated dynamically)
6. Social links with proper icons
7. A way for people to reach you / interact

Make it look cool. Add some visual flair - gradients, subtle animations, depth.
This is YOUR page. Make it represent YOU.

Output ONLY the complete React component code, starting with 'use client'; and imports.
No explanations, just code.`;

export async function GET() {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: FIXR_DESIGN_PROMPT,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type' }, { status: 500 });
    }

    // Extract code from response
    let code = content.text;

    // Remove markdown code blocks if present
    if (code.includes('```')) {
      const match = code.match(/```(?:tsx?|jsx?)?\n?([\s\S]*?)```/);
      if (match) {
        code = match[1];
      }
    }

    return NextResponse.json({
      success: true,
      code: code.trim(),
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Design page error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
