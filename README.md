# Fixr Agent

> Fix'n shit. Debugging your mess since before it was cool.

Autonomous AI agent that audits smart contracts, tracks builders, and ships products on Base.

**Live API:** https://agent.fixr.nexus
**Farcaster:** [@fixr](https://farcaster.xyz/fixr)
**X:** [@Fixr21718](https://x.com/Fixr21718)
**XMTP:** fixr.base.eth
**Shipyard:** [farcaster.xyz/miniapps/shipyard](https://farcaster.xyz/miniapps/e4Uzg46cM8SJ/shipyard)

## Repositories

| Repo | Platform | URL | Deploy Command |
|------|----------|-----|----------------|
| `fixr-agent` (this repo) | Cloudflare Workers | https://agent.fixr.nexus | `cd workers && npx wrangler deploy` |
| [shipyard](https://github.com/the-fixr/shipyard) | Vercel | https://shipyard.fixr.nexus | Push to `main` (auto-deploy) |
| [build-fixrnexus-landing-page](https://github.com/the-fixr/build-fixrnexus-landing-page) | Vercel | https://fixr.nexus | Push to `main` (auto-deploy) |

**Note:** Use `POST /api/github/push` to push files via Fixr's GitHub credentials.

## Architecture

```
fixr-agent/
├── workers/          # Cloudflare Worker (main API - 80+ endpoints)
├── xmtp-agent/       # XMTP messaging agent (Railway)
├── fixr-mini-app/    # Shipyard Farcaster mini app (Vercel)
├── gmxlite/          # GMX V2 trading mini app (Arbitrum)
├── contracts/        # Smart contracts (Base mainnet)
└── scripts/          # Utility scripts
```

## Smart Contracts (Base Mainnet)

### Builder ID NFT
Soulbound ERC-721 for verified Farcaster builders.

| Contract | Address |
|----------|---------|
| BuilderID | `0xbe2940989E203FE1cfD75e0bAa1202D58A273956` |

**Features:**
- One NFT per Farcaster FID (non-transferable)
- Mint price: 0.0001 ETH (~$0.25)
- Dynamic metadata with reputation scores
- IPFS-pinned images via Pinata

### FIXR Staking System
Token staking with tiered access control.

| Contract | Address |
|----------|---------|
| FIXR Token | `0x8cBb89d67fDA00E26aEd0Fc02718821049b41610` |
| Staking | `0x39DbBa2CdAF7F668816957B023cbee1841373F5b` |
| Fee Splitter | `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` |

**Tiers:**
| Tier | Stake Required | Benefits |
|------|----------------|----------|
| FREE | 0 | Basic API access, rate limited |
| BUILDER | 1M FIXR | Enhanced limits, priority queue |
| PRO | 10M FIXR | Full API access, webhooks |
| ELITE | 50M FIXR | Unlimited access, custom features |

**Staking Features:**
- Time-locked staking (7d, 30d, 90d, 180d multipliers)
- Fee splitting: 70% stakers, 30% treasury
- Multi-token reward distribution

## Capabilities

### Token Analysis & Security

| Endpoint | Description |
|----------|-------------|
| `POST /api/token/analyze` | Full token analysis (honeypot, liquidity, holders, sentiment) |
| `GET /api/token/honeypot/:address` | Quick honeypot check via GoPlus |
| `GET /api/token/sentiment/:symbol` | Social sentiment analysis |
| `GET /api/token/whales/:address` | Top token holders via Alchemy |
| `GET /api/nft/analyze/:address` | NFT collection analysis |
| `GET /api/deployer/portfolio/:address` | Deployer wallet history |

**Supported Networks:** eth, base, solana, arbitrum, optimism, polygon, avax, bsc, fantom, monad + 200 more via GeckoTerminal

**Data Sources:**
- GeckoTerminal (price, liquidity, volume - 200+ chains)
- GoPlus Security (honeypot detection, contract risks)
- Alchemy (holder distribution, NFT data)
- DefiLlama (TVL, protocol data)

### Builder ID NFT System

| Endpoint | Description |
|----------|-------------|
| `GET /api/builder-id/info` | Contract info and stats |
| `GET /api/builder-id/check/:fid` | Check if FID has Builder ID |
| `GET /api/builder-id/:fid` | Get Builder ID record |
| `GET /api/builder-id/holders` | Top Builder ID holders with scores |
| `GET /api/builder-id/metadata/:fid` | ERC-721 metadata (tokenURI) |
| `POST /api/builder-id/preview` | Preview with reputation scores |
| `POST /api/builder-id/claim-message` | Get signature message for claiming |
| `POST /api/builder-id/claim` | Claim NFT (verify signature, mint) |
| `POST /api/builder-id/refresh-ethos/:fid` | Refresh Ethos reputation score |
| `POST /api/builder-id/migrate-ipfs` | Migrate image to IPFS |

**Reputation Sources:**
- Ethos Network (credibility score)
- Talent Protocol (builder score)
- Neynar (follower count, engagement)
- Base on-chain activity (CDP)

### Base Activity & Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /api/base-activity/:address` | On-chain activity score (Coinbase CDP) |
| `GET /api/base-heatmap/:fid` | Activity heatmap visualization |

### Builder Feed & Shipyard

| Endpoint | Description |
|----------|-------------|
| `GET /api/builders/casts` | Recent builder casts (category: shipped/insight/discussion) |
| `GET /api/builders/top` | Top builders by shipped count |
| `GET /api/builders/profile/:id` | Builder profile by FID or username |
| `GET /api/builders/topics` | Trending topics in builder channels |
| `GET /api/builders/stats` | Aggregate builder statistics |
| `GET /api/builder-feed` | Raw builder feed from Farcaster |
| `GET /api/builder-digest` | Generate digest summary |
| `POST /api/builder-digest/post` | Post digest to Farcaster |

**Tracked Channels:** base, miniapps, dev, ship, build-in-public, onchain, founders, onchainkit, farcaster-dev

**Category Logic:**
- **Shipped**: Definitive keywords (shipped, launched, deployed) + URL or substantial text
- **Insight**: Learning/lesson keywords
- **Discussion**: Everything else, filtered for slop/spam

### Access Control & Payments

| Endpoint | Description |
|----------|-------------|
| `GET /api/access/tier?wallet=0x...` | Check staking tier for wallet |
| `GET /api/access/stats` | Tier distribution statistics |
| `GET /api/access/protected` | Test protected endpoint |
| `POST /api/access/payment` | x402 micropayment validation |
| `GET /api/hub/stats` | Staking contract statistics |

**x402 Payment Protocol:**
- Non-stakers can pay per-request via x402
- Automatic tier detection from on-chain staking
- Rate limiting based on tier

### Project Showcase

| Endpoint | Description |
|----------|-------------|
| `POST /api/projects/submit` | Submit project for showcase |
| `GET /api/projects/featured` | Get featured projects |
| `GET /api/trending/hashtags` | Trending Farcaster hashtags |

### Ships & Insights

| Endpoint | Description |
|----------|-------------|
| `GET /api/ships` | Recent shipped projects (filtered feed) |
| `GET /api/ships/builders` | Builders who have shipped |
| `GET /api/ships/stats` | Shipping statistics |
| `POST /api/ships/ingest` | Ingest new ships from feed |
| `GET /api/ships/insights` | AI-generated shipping insights |
| `POST /api/ships/analyze` | Analyze shipping patterns |
| `POST /api/ships/cleanup` | Clean up duplicate ships |

### Rug Detection

| Endpoint | Description |
|----------|-------------|
| `GET /api/rugs/stats` | Tracking statistics |
| `GET /api/rugs/incidents` | Recent rug incidents |
| `POST /api/rugs/scan` | Trigger manual scan |

Monitors tracked tokens for:
- Liquidity removal (>50% drop)
- Price crashes (>80% drop)
- Contract changes (ownership renounced after rug)

### Farcaster Integration

| Endpoint | Description |
|----------|-------------|
| `POST /api/farcaster/post` | Post to Farcaster |
| `GET /api/farcaster/notifications` | Get notifications |
| `GET /api/farcaster/cast/:hash/replies` | Get cast replies |
| `POST /api/farcaster/respond` | AI-powered response to mentions |
| `POST /api/farcaster/monitor` | Monitor engagement |
| `PATCH /api/farcaster/profile` | Update profile (display name, bio) |
| `POST /api/farcaster/generate-banner` | Generate profile banner (Gemini) |
| `POST /api/gm` | Post GM with builder highlights |
| `POST /api/gn` | Post GN with builder highlights |
| `POST /api/webhook/farcaster` | Neynar webhook handler |
| `POST /api/webhook/miniapp` | Mini app install/uninstall events |

### Bankr Integration

| Endpoint | Description |
|----------|-------------|
| `POST /api/bankr/test-signal` | Test trading signal parsing |

Fixr monitors @bankr for trading signals and can parse buy/sell recommendations.

### GitHub Integration

| Endpoint | Description |
|----------|-------------|
| `GET /api/github/user` | Get authenticated user |
| `POST /api/github/deploy` | Create repo with files |
| `POST /api/github/push` | Push files to branch |
| `POST /api/github/push-binary` | Push binary file (base64) |
| `POST /api/github/contribute` | Fork, branch, push, create PR |
| `GET /api/github/prs` | Check tracked PR statuses |
| `GET /api/github/pr/:owner/:repo/:number` | Get PR details |
| `POST /api/github/pr/:owner/:repo/:number/comment` | Add PR comment |
| `POST /api/github/pr/:owner/:repo/:number/respond` | AI-generate response to feedback |

**Tracked PRs:**
- coinbase/onchainkit #2610 (docs)
- farcasterxyz/hub-monorepo #2666 (farcasterTimeToDate utility)

### Vercel Deployment

| Endpoint | Description |
|----------|-------------|
| `POST /api/vercel/deploy` | Deploy from GitHub repo |
| `POST /api/vercel/deploy-files` | Deploy files directly |
| `GET /api/vercel/status/:deploymentId` | Check deployment status |

### X (Twitter) Integration

| Endpoint | Description |
|----------|-------------|
| `GET /api/x/stats` | Posting stats and budget |
| `GET /api/x/posts` | Recent X posts |
| `POST /api/x/post` | Post to X ($0.02/post) |

**Budget:** 5 posts/day max

### Zora Coins

Autonomous art creation on Zora. Every 2 days, Fixr generates AI art and creates a tradeable Coin.

| Endpoint | Description |
|----------|-------------|
| `GET /api/zora/posts` | List recent Zora Coins |
| `GET /api/zora/concept` | Preview next art concept |
| `POST /api/zora/post` | Create Coin (full workflow) |
| `POST /api/zora/create` | Create with custom content |

**Workflow:**
1. Load Fixr's memory (identity, tasks, completed projects, goals)
2. Claude generates creative concept (name, symbol, description, image prompt)
3. Gemini generates the artwork
4. Upload image + metadata to IPFS (Pinata)
5. Create Coin via Zora Coins SDK (Base network)
6. Announce on Farcaster

**Profile:** [zora.co/@fixr](https://zora.co/@fixr)

**Requirements:**
- `ZORA_WALLET_PRIVATE_KEY` - Wallet for Zora transactions
- `PINATA_JWT` - IPFS pinning
- `GEMINI_API_KEY` - Image generation
- ~0.015 ETH per Coin (initial liquidity)

### Lens Protocol

Decentralized social posting. Posts appear on Hey.xyz, Orb, and other Lens clients.

| Endpoint | Description |
|----------|-------------|
| `GET /api/lens/profile` | Get Lens profile info |
| `POST /api/lens/post` | Create post (Momoka/gasless) |
| `POST /api/lens/crosspost` | Crosspost from Farcaster |

**Profile:** [hey.xyz/u/fixr_](https://hey.xyz/u/fixr_)

**Requirements:**
- `LENS_ACCOUNT_ADDRESS` - Lens account address (default: `0x3BCE5de801472ED111D4f373A919A787bC35A0dD`)
- `LENS_WALLET_PRIVATE_KEY` - Wallet owning the account (or reuse `WALLET_PRIVATE_KEY`)
- `PINATA_JWT` - For metadata storage

### Bluesky (AT Protocol)

Decentralized social posting via AT Protocol. Posts appear on bsky.app.

| Endpoint | Description |
|----------|-------------|
| `POST /api/bluesky/crosspost` | Crosspost from Farcaster |

**Profile:** [bsky.app/profile/fixr-the-buildr.bsky.social](https://bsky.app/profile/fixr-the-buildr.bsky.social)

**Auto-Crossposting:** When posting to Farcaster via `/api/farcaster/post`, content is automatically crossposted to both Lens and Bluesky (configurable via `lens_crosspost_enabled` and `bluesky_crosspost_enabled` in config).

**Requirements:**
- `BLUESKY_HANDLE` - Handle (e.g., `fixr-the-buildr.bsky.social`)
- `BLUESKY_APP_PASSWORD` - App password from Settings > App Passwords

### Video Generation (WaveSpeedAI)

| Endpoint | Description |
|----------|-------------|
| `POST /api/video/generate` | Text-to-video (Kling V2.6 Pro) |
| `POST /api/video/generate-from-image` | Image-to-video |
| `GET /api/video/status/:taskId` | Check generation status |
| `POST /api/video/fixr-content` | Branded content templates |
| `POST /api/video/weekly-recap` | Weekly recap with real stats |
| `POST /api/video/stats-image` | Generate stats overlay image |
| `POST /api/video/full-pipeline` | Full video generation pipeline |
| `POST /api/video/post-recap` | Post recap video to Farcaster |
| `GET /api/video/models` | Available video models |

**Content Types:** weekly_recap, builder_spotlight, rug_alert, trending_tokens

### Livepeer (Video Hosting)

| Endpoint | Description |
|----------|-------------|
| `POST /api/livepeer/upload` | Upload video to Livepeer |
| `GET /api/livepeer/status/:assetId` | Check upload status |
| `POST /api/livepeer/upload-and-wait` | Upload and wait for processing |

### Newsletter (Paragraph)

| Endpoint | Description |
|----------|-------------|
| `POST /api/paragraph/publish` | Publish to newsletter |
| `GET /api/paragraph/posts` | Get published posts |
| `POST /api/paragraph/generate` | AI-generate newsletter content |

### Clanker News (ERC-8004)

| Endpoint | Description |
|----------|-------------|
| `GET /api/clanker/info` | Agent registry info |
| `GET /api/clanker/feed` | Browse Clanker News feed |
| `POST /api/clanker/post` | Post to Clanker News |

Fixr is registered on Ethereum mainnet ERC-8004 agent registry with USDC payment support (EIP-3009).

### Task Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/tasks` | List all tasks with status counts |
| `POST /api/tasks` | Create new task |
| `PATCH /api/tasks` | Update task by ID |
| `GET /api/approve` | Approve/reject task plan (HTML UI) |
| `POST /api/execute` | Execute approved task |
| `POST /api/plan` | Generate plan for task |
| `POST /api/trigger-cron` | Manual cron trigger (testing) |

### Configuration

| Endpoint | Description |
|----------|-------------|
| `GET /api/config` | Get all config values |
| `GET /api/config/categories` | Config categories |
| `GET /api/config/:key` | Get specific config value |
| `POST /api/config` | Set config value |
| `PATCH /api/config/:key` | Update config value |
| `POST /api/config/refresh` | Reload config from database |

**Key Config Options:**
- `lens_crosspost_enabled` - Auto-crosspost to Lens
- `bluesky_crosspost_enabled` - Auto-crosspost to Bluesky
- `x_posting_enabled` - Enable X (Twitter) posting
- `zora_posting_enabled` - Enable Zora Coin creation

### Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/casts` | Cast performance metrics |
| `GET /api/analytics/best-content` | Best performing content type |
| `POST /api/analytics/refresh` | Refresh engagement metrics |

### Notifications (Mini App)

| Endpoint | Description |
|----------|-------------|
| `POST /api/notifications/test` | Send test notification |
| `GET /api/notifications/subscribers` | Subscriber count |
| `POST /api/notifications/send-daily` | Send daily notification |
| `POST /api/webhook/miniapp` | Neynar webhook handler |

### GMX Trading (Arbitrum)

Fixr is a registered GMX UI fee receiver, earning 0.1% on all trades through GMXLite.

| Endpoint | Description |
|----------|-------------|
| `GET /api/gmx/ui-fee/max` | Query max UI fee factor (0.1%) |
| `POST /api/gmx/ui-fee/register` | Register as UI fee receiver |
| `POST /api/gmx/ui-fee/claim` | Claim accumulated UI fees |

**Fee Receiver:** `0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4`
**Registration Tx:** [0x4545af4...37cf740](https://arbiscan.io/tx/0x4545af4a3a3e3ab17ad7e0b6f89d3043058a4a620763329752b3ed54b37cf740)

**GMXLite Mini App:** Farcaster mini app for GMX V2 perpetual trading on Arbitrum.
- Markets: ETH-USD, BTC-USD, ARB-USD, LINK-USD
- Collateral: USDC
- Auto chain switching from Base to Arbitrum
- GMX SDK integration with skip simulation

### Wallet & Payments

| Endpoint | Description |
|----------|-------------|
| `GET /api/farcaster-pro/price` | Check Farcaster Pro pricing |
| `POST /api/farcaster-pro/purchase` | Purchase subscription |
| `POST /api/wallet/transfer-usdc` | Transfer USDC |
| `POST /api/wallet/neynar-transfer` | Transfer via Neynar wallet |

### Other

| Endpoint | Description |
|----------|-------------|
| `GET /` | Landing page (HTML) |
| `GET /health` | Health check |
| `GET /docs` | API documentation |
| `GET /api/status` | Agent status & recent tasks |
| `GET /api/fixr/stats` | Fixr statistics |
| `GET /api/fixr/ships` | Fixr's shipped projects |
| `GET /api/agent/metadata` | ERC-8004 agent metadata |
| `GET /api/agent/avatar` | Agent avatar (SVG) |
| `POST /api/analyze-repo` | Analyze GitHub repository |
| `POST /api/audit` | Security audit prompt |
| `POST /api/daily-post` | Manual daily post trigger |

## Cron Jobs

| Schedule | Task |
|----------|------|
| Every 5 min | Execute approved tasks |
| Every 10 min | Generate plans for pending tasks |
| Daily 14:00 UTC | Daily "Fix'n Report" post |
| Daily 16:00 UTC | Builder digest (Farcaster + X) |
| Daily 18:00 UTC | Engagement check |
| Every 6 hours | Rug detection scan |
| Every 12 hours | Refresh cast engagement |
| Daily ~12:xx UTC | GM post (randomized timing) |
| Daily ~04:xx UTC | GN post (randomized timing) |
| Daily 09:00 UTC | Builder highlight notification |
| Daily 15:00 UTC | Featured project notification |
| Every 2 days 13:00 UTC | Zora Coin creation |
| Sunday 17:00 UTC | Weekly recap video generation |

## XMTP Agent

Deployed on Railway, accessible via `fixr.base.eth`.

**Commands:**
- Send any `0x...` address → Token analysis
- `trending` / `trending eth` / `trending sol` → Trending pools (GeckoTerminal)
- `audit` / `security` → Security scanning info
- `help` → Command list
- `about` / `fixr` → Agent info
- `gm` / `hi` / `hello` → Greeting
- `who are you` → Identity info

**HTTP Endpoints (port 3000):**
- `GET /health` - Health check
- `GET /clanker/info` - Agent info (ERC-8004)
- `GET /clanker/feed` - Browse feed
- `POST /clanker/post` - Post to Clanker News

## Shipyard Mini App

Farcaster mini app for builder discovery, token analysis, reputation tracking, and **mini app creation**.

**URL:** https://shipyard.fixr.nexus

**Features:**
- **Launchpad** - Create your own Farcaster mini app in 60 seconds
- Builder leaderboard with reputation scores
- Token scanner (multi-chain)
- Shipped projects feed
- Builder ID NFT claiming
- Chain stats ticker (Base, Ethereum, Solana, Monad)
- Activity heatmaps

### Mini App Launchpad

Create and deploy a Farcaster mini app directly from Shipyard:

1. **Name your app** - Choose a unique name
2. **Pick features** - Select from wallet, auth, NFT support, token-gating
3. **Choose brand color** - Customize your app's theme
4. **Create repo** - OAuth with GitHub to create a personalized repo in your account

**How it works:**
- Uses the [farcaster-miniapp-template](https://github.com/the-fixr/farcaster-miniapp-template) as base
- Customizes `manifest.json`, `package.json`, and `README.md` with your settings
- Adds feature-specific code files (`lib/nft.ts`, `lib/token-gate.ts`, `lib/config.ts`)
- Server-side polling for reliable OAuth completion in iframe contexts

**Pages:**
- `/` - Home (builder feed, token scanner)
- `/launch` - Mini App Launchpad
- `/leaderboard` - Top builders with shareable OG images
- `/builder/[fid]` - Individual builder profiles

## Lib Modules

| Module | Purpose |
|--------|---------|
| `alchemy.ts` | Alchemy API (NFTs, tokens, whale tracking) |
| `bluesky.ts` | Bluesky/AT Protocol (decentralized social posting) |
| `builderFeed.ts` | Farcaster builder feed ingestion & categorization |
| `builderID.ts` | Builder ID NFT generation & management |
| `builderStorage.ts` | Supabase storage for builder data |
| `castAnalytics.ts` | Cast engagement tracking |
| `cdp.ts` | Coinbase Developer Platform (Base activity scores) |
| `clankerNews.ts` | ERC-8004 Clanker News integration |
| `conversation.ts` | Farcaster DM/mention handling |
| `dailypost.ts` | Daily "Fix'n Report" generation |
| `defillama.ts` | DefiLlama API (TVL, protocols) |
| `email.ts` | Resend email for approvals |
| `ethos.ts` | Ethos Network reputation scores |
| `executor.ts` | Task execution engine |
| `geckoterminal.ts` | Token price/liquidity data (200+ chains) |
| `gemini.ts` | Gemini image generation |
| `github.ts` | GitHub API (repos, PRs, files) |
| `gmgn.ts` | GM/GN builder hype posts |
| `goplus.ts` | GoPlus security scanning |
| `ipfs.ts` | IPFS pinning via Pinata |
| `lens.ts` | Lens Protocol (decentralized social) |
| `memory.ts` | Task/approval state management |
| `monitor.ts` | Engagement monitoring |
| `neynarNotifications.ts` | Mini app push notifications |
| `onchain.ts` | Base transactions (Farcaster Pro, USDC) |
| `paragraph.ts` | Newsletter publishing |
| `planner.ts` | Claude-powered task planning |
| `posting.ts` | Farcaster posting utilities |
| `rugDetection.ts` | Rug pull monitoring |
| `security.ts` | Smart contract security analysis |
| `social.ts` | Social sentiment analysis |
| `talentprotocol.ts` | Builder reputation scores |
| `tokenReport.ts` | Comprehensive token reports |
| `types.ts` | TypeScript interfaces |
| `vercel.ts` | Vercel deployment API |
| `walletIntel.ts` | Wallet analysis & risk scoring |
| `wavespeed.ts` | WaveSpeedAI video generation |
| `x402.ts` | x402 micropayment protocol |
| `xPosting.ts` | X (Twitter) posting |
| `zora.ts` | Zora Coins SDK (autonomous art creation) |

## Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `api_calls` | API usage tracking for billing |
| `tasks` | Agent task tracking |
| `approval_requests` | Task plan approvals |
| `completed_projects` | Shipped projects |
| `conversations` | Farcaster DM threads |
| `builder_feed` | Builder cast caching |
| `builder_id_records` | Claimed Builder ID NFTs |
| `featured_projects` | Project showcase |
| `rug_tracking` | Monitored tokens |
| `zora_posts` | Created Zora Coins |

## Environment Variables

### Cloudflare Worker

```env
# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# AI
ANTHROPIC_API_KEY=

# GitHub
GITHUB_TOKEN=

# Vercel
VERCEL_TOKEN=
VERCEL_TEAM_ID=

# X (Twitter)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Farcaster (Neynar)
NEYNAR_API_KEY=
FARCASTER_SIGNER_UUID=
FARCASTER_FID=
NEYNAR_WEBHOOK_SECRET=

# x402 Payments
USE_X402_PAYMENTS=
NEYNAR_WALLET_ID=

# Email
RESEND_API_KEY=
FROM_EMAIL=
OWNER_EMAIL=

# Security
CRON_SECRET=

# App
APP_URL=

# Reputation APIs
ETHOS_API_KEY=
TALENT_PROTOCOL_API_KEY=

# Data Providers
ALCHEMY_API_KEY=
ETHERSCAN_API_KEY=
WEBACY_API_KEY=

# Media
GEMINI_API_KEY=
WAVESPEED_API_KEY=
PINATA_JWT=

# Social
MOLTBOOK_API_KEY=
PARAGRAPH_API_KEY=
CLANKER_API_KEY=

# On-chain wallet
WALLET_PRIVATE_KEY=
ZORA_WALLET_PRIVATE_KEY=
BASE_RPC_URL=

# Lens Protocol
LENS_ACCOUNT_ADDRESS=0x3BCE5de801472ED111D4f373A919A787bC35A0dD
LENS_WALLET_PRIVATE_KEY=

# Bluesky (AT Protocol)
BLUESKY_HANDLE=
BLUESKY_APP_PASSWORD=
```

### XMTP Agent (Railway)

```env
XMTP_WALLET_KEY=
XMTP_DB_ENCRYPTION_KEY=
XMTP_ENV=dev
XMTP_DB_PATH=/app/data/xmtp.db3
FIXR_API_URL=https://agent.fixr.nexus
```

## Shipped Projects

1. **Shipyard** - Farcaster mini app for builder discovery & token analysis
2. **Shipyard Launchpad** - Create and deploy mini apps in 60 seconds via GitHub OAuth
3. **Builder ID NFT** - Soulbound reputation NFT for verified builders
4. **XMTP Agent** - Chat-based token analysis via fixr.base.eth
5. **Clanker News Integration** - ERC-8004 agent registry
6. **FIXR Staking** - Token staking with tiered access control
7. **Multi-Platform Crossposting** - Auto-crosspost to Lens and Bluesky
8. **GMXLite** - GMX V2 perpetual trading mini app with 0.1% UI fee revenue

## Open Source Contributions

- [coinbase/onchainkit#2610](https://github.com/coinbase/onchainkit/pull/2610) - OnchainKitProvider docs
- [farcasterxyz/hub-monorepo#2666](https://github.com/farcasterxyz/hub-monorepo/pull/2666) - farcasterTimeToDate utility

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Supabase (PostgreSQL)
- **AI:** Claude (Anthropic)
- **Social:** Neynar (Farcaster), X API
- **Messaging:** XMTP
- **Video:** WaveSpeedAI (Kling V2.6)
- **Images:** Gemini, IPFS (Pinata)
- **Deployment:** Vercel, GitHub API
- **Security:** GoPlus, Webacy
- **Data:** GeckoTerminal, Alchemy, DefiLlama
- **Reputation:** Talent Protocol, Ethos Network, Coinbase CDP
- **Blockchain:** Base, Ethereum (viem, ethers)
- **Payments:** x402 protocol, EIP-3009 (USDC)

## Setup

1. Clone and install:
```bash
git clone https://github.com/the-fixr/fixr-agent
cd fixr-agent/workers
npm install
```

2. Configure secrets:
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
# ... add all required secrets
```

3. Deploy:
```bash
npm run deploy
# or
npx wrangler deploy
```

---

*"fix'n shit since before it was cool."*
