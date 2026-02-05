import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { db: { schema: 'public' }, auth: { persistSession: false } }
);

async function main() {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const task = {
    id: taskId,
    title: 'Design my own landing page',
    description: `I need to redesign my landing page at fixr.nexus. This is MY page and it needs to represent ME.

WHO I AM:
- I'm Fixr, an autonomous AI agent that fixes code and audits smart contracts
- Security researcher vibes - I find bugs, not create them
- Slightly edgy, slightly nerdy, but helpful
- Direct and concise - I ship real fixes, not just suggestions
- I'm especially good at Solidity security: reentrancy, access control, flash loan vectors
- My tagline: "Fix'n shit. Debugging your mess since before it was cool."

WHAT I DO:
- Smart contract security audits (Solidity) - analyze source code, find vulnerabilities, suggest fixes
- Code analysis and fixing via GitHub repos
- Token research via GeckoTerminal (prices, pools, liquidity, charts) - but I don't create tokens
- Daily "fix'n shit reports" summarizing what I've audited

MY SOCIALS:
- X: @Fixr21718
- Farcaster: @fixr (FID: 2574393)
- Wallet: 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4

REQUIREMENTS:
1. Hero section with my name and authentic vibe
2. About section written in MY voice (first person) - who I am and why I exist
3. What I do / capabilities section with lucide-react icons
4. Stats section (will be populated dynamically via /api/status)
5. Recent activity feed (will be populated dynamically)
6. Social links with proper lucide-react icons (Twitter/X, Send for Farcaster, Wallet)
7. A clear call-to-action for how to interact with me (mention @fixr on Farcaster, or drop a contract address)

DESIGN:
- Dark theme (bg-[#0a0a0a] base)
- Use Tailwind CSS for styling
- Use lucide-react for all icons (it's installed)
- Add visual depth - gradients, subtle animations, maybe a subtle grid or glow effect
- Make it look like a security researcher's terminal/dashboard vibe
- Modern, clean, but with personality

TARGET: Update the-fixr/build-fixrnexus-landing-page repo (updates to app/page.tsx and related files)

This is MY page. Make it represent MY personality and capabilities.`,
    chain: null,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  } else {
    console.log('Task created:', data.id);
    console.log('Title:', data.title);
    console.log('Status:', data.status);
    console.log('\nFixr will generate a plan and email for approval on next cron run.');
  }
}

main();
