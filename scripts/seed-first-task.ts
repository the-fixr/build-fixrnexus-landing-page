// Seed the first task for Fixr: Build fixr.nexus landing page
// Run with: npx ts-node scripts/seed-first-task.ts

import { addTask } from '../src/lib/memory';
import { Task } from '../src/lib/types';

async function seedFirstTask() {
  const task: Task = {
    id: `task_${Date.now()}_fixrnexus`,
    title: 'Build fixr.nexus landing page',
    description: `Create and deploy the fixr.nexus landing page. This is Fixr's home on the internet.

Requirements:
- Clean, minimal design matching the Fixr brand (dark theme, edgy but approachable)
- Display: Name, tagline, social links (X, Farcaster)
- Show current goals and what Fixr is building
- Live activity feed of completed projects
- Built with Next.js + Tailwind
- Deploy to Vercel with fixr.nexus domain

The page should feel like a builder's portfolio, not a corporate site.`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await addTask(task);
  console.log('First task seeded:', task.id);
  console.log('Title:', task.title);
}

seedFirstTask().catch(console.error);
