# Fixr Agent - Cloudflare Workers

Fixr is an autonomous builder agent that ships real projects. This is the Cloudflare Workers version migrated from Vercel serverless.

## Project Structure

```
workers/
├── src/
│   ├── index.ts          # Main entry point with Hono router
│   └── lib/
│       ├── types.ts      # TypeScript types and Env bindings
│       ├── memory.ts     # Supabase integration
│       ├── planner.ts    # Claude AI plan/code generation
│       ├── executor.ts   # Task execution engine
│       ├── github.ts     # GitHub/Octokit integration
│       ├── vercel.ts     # Vercel deployment API
│       ├── social.ts     # X and Farcaster posting
│       └── email.ts      # Resend email integration
├── wrangler.toml         # Cloudflare Workers config
├── package.json
└── tsconfig.json
```

## API Endpoints

- `GET /` - Health check
- `GET /api/status` - Agent status and stats
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks` - Update task
- `GET /api/approve` - Handle email approval links
- `POST /api/execute` - Manual task execution trigger
- `POST /api/webhook/farcaster` - Neynar webhook receiver

## Cron Triggers

Configured in `wrangler.toml`:
- `*/10 * * * *` - Plan generation (every 10 minutes)
- `*/5 * * * *` - Task execution (every 5 minutes)
- `0 14 * * *` - Daily check-in (2:14 PM UTC)

## Setup

### 1. Install dependencies

```bash
cd workers
npm install
```

### 2. Configure secrets

Set all required secrets using wrangler:

```bash
# Database
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY

# AI
wrangler secret put ANTHROPIC_API_KEY

# GitHub
wrangler secret put GITHUB_TOKEN

# Vercel
wrangler secret put VERCEL_TOKEN
wrangler secret put VERCEL_TEAM_ID

# X (Twitter)
wrangler secret put X_API_KEY
wrangler secret put X_API_SECRET
wrangler secret put X_ACCESS_TOKEN
wrangler secret put X_ACCESS_SECRET

# Farcaster (Neynar)
wrangler secret put NEYNAR_API_KEY
wrangler secret put FARCASTER_SIGNER_UUID
wrangler secret put FARCASTER_FID
wrangler secret put NEYNAR_WEBHOOK_SECRET

# Email
wrangler secret put RESEND_API_KEY

# Security
wrangler secret put CRON_SECRET
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Local Development

```bash
npm run dev
```

## Key Differences from Vercel

1. **Web Crypto API**: Uses `crypto.subtle` instead of Node.js `crypto` module
2. **No Node.js globals**: `Buffer` replaced with `btoa`/`atob`, `process.env` replaced with `env` parameter
3. **Hono router**: Replaces Next.js API routes
4. **Cron Triggers**: Built-in cron support via `wrangler.toml` instead of vercel.json
5. **Environment bindings**: Typed `Env` interface passed to all functions

## Task Workflow

```
pending → planning → awaiting_approval → approved → executing → completed/failed
```

1. **pending**: Task created, waiting for plan
2. **planning**: AI generating execution plan
3. **awaiting_approval**: Plan ready, email sent for approval
4. **approved**: User approved, ready for execution
5. **executing**: Steps being executed
6. **completed/failed**: Final state
