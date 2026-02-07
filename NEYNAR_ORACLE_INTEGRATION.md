# Neynar API Integration for FEEDS Oracles

## Overview

Neynar is the leading Farcaster infrastructure provider, offering comprehensive APIs for accessing social graph data, casts, user profiles, channels, and real-time activity from the Farcaster decentralized social network.

**Why Neynar over Direct Farcaster API:**
- ✅ **More comprehensive** - Full REST API with all Farcaster data
- ✅ **Better performance** - Indexed and optimized queries
- ✅ **Real-time webhooks** - Event-driven architecture
- ✅ **Easier to use** - SDKs for Node.js, Rust, Go
- ✅ **Additional features** - Onchain data integration, notifications
- ✅ **Free tier available** - "Start for free" on all plans

---

## Neynar API Capabilities

### 1. User APIs
**Data Available:**
- Complete user profiles with verification data
- Follower/following relationships and counts
- Mutual connections
- "Best friends" identification
- Search by username, ETH/SOL addresses, location
- User activity metrics

**Oracle Use Cases:**
```typescript
interface UserMetrics {
  fid: number;
  username: string;
  followers: number;
  following: number;
  casts_count: number;
  engagement_rate: number;
  verified_addresses: string[];
}
```
- **Influencer tracking** - Monitor top Farcaster accounts
- **Social reputation** - Use follower count as trust signal
- **Identity verification** - Link Farcaster to wallet addresses

---

### 2. Cast APIs
**Data Available:**
- Cast lookup by URL or hash
- Post/delete casts programmatically
- Search casts by keywords
- Cast conversations and threads
- Cast metrics (likes, recasts, replies)
- Quoted casts
- Embedded URL metadata

**Oracle Use Cases:**
```typescript
interface CastMetrics {
  hash: string;
  text: string;
  author_fid: number;
  timestamp: number;
  likes: number;
  recasts: number;
  replies: number;
  engagement_score: number;
}
```
- **Viral content detection** - Track trending casts
- **Sentiment analysis** - Analyze cast text for token mentions
- **Engagement tracking** - Measure cast performance over time

---

### 3. Feed APIs
**Data Available:**
- User following feeds
- Trending/for-you content
- Channel-specific feeds
- Topic-based feeds
- Parent URL-based feeds

**Oracle Use Cases:**
```typescript
interface TrendingFeed {
  trending_casts: Cast[];
  trending_topics: string[];
  active_channels: Channel[];
  engagement_24h: number;
}
```
- **Trending topics** - What's hot on Farcaster right now
- **Channel activity** - Monitor specific crypto communities
- **Content discovery** - Find relevant discussions

---

### 4. Reaction APIs
**Data Available:**
- Likes and recasts per cast
- User-level reactions
- Publish/delete reactions
- Reaction aggregations

**Oracle Use Cases:**
```typescript
interface ReactionData {
  cast_hash: string;
  total_likes: number;
  total_recasts: number;
  top_reactors: number[]; // FIDs
  viral_velocity: number; // reactions per hour
}
```
- **Virality detection** - Fast-growing casts
- **Engagement metrics** - Social proof signals

---

### 5. Channel APIs
**Data Available:**
- Search and fetch channels
- Member invitations
- Channel follows
- Trending channels
- User channel memberships
- Active channels

**Oracle Use Cases:**
```typescript
interface ChannelMetrics {
  channel_id: string;
  name: string;
  follower_count: number;
  cast_count_24h: number;
  active_members: number;
  trending_rank: number;
}
```
- **Community health** - Track channel activity
- **Topic tracking** - Monitor crypto/DeFi channels
- **Growth metrics** - Channel member growth

---

### 6. Follow APIs
**Data Available:**
- Follow/unfollow functionality
- Followers and following lists
- Follow suggestions
- Reciprocal relationships

**Oracle Use Cases:**
```typescript
interface FollowGraph {
  fid: number;
  new_followers_24h: number;
  new_following_24h: number;
  follow_back_rate: number;
  mutual_connections: number;
}
```
- **Social graph analysis** - Network growth
- **Influence mapping** - Who follows whom

---

### 7. Notification APIs
**Data Available:**
- User notifications
- Channel-specific notifications
- Parent URL-specific notifications
- Seen/unseen status

**Oracle Use Cases:**
```typescript
interface NotificationFeed {
  fid: number;
  unread_count: number;
  recent_mentions: Cast[];
  new_followers: number;
}
```
- **Mention tracking** - When tokens/projects are mentioned
- **Alert systems** - Real-time notification feeds

---

### 8. Webhooks (Real-Time Events)
**Data Available:**
- Cast created/deleted events
- Follow/unfollow events
- Reaction events
- User events
- Channel events

**Oracle Use Cases:**
```typescript
interface WebhookEvent {
  type: 'cast.created' | 'user.followed' | 'reaction.created';
  data: any;
  timestamp: number;
}
```
- **Real-time alerts** - Instant notifications
- **Event-driven oracles** - Trigger on social events
- **Live feeds** - Update oracle immediately on new data

---

### 9. Onchain Data Integration
**Data Available:**
- User token balances
- NFT holdings
- Hypersub subscriptions
- Fungible token data

**Oracle Use Cases:**
```typescript
interface OnchainProfile {
  fid: number;
  eth_balance: number;
  top_tokens: Token[];
  nft_count: number;
  hypersubs: string[];
}
```
- **Wallet-to-social mapping** - Link onchain to offchain identity
- **Token holder sentiment** - What are DEGEN holders saying?
- **NFT community tracking** - Holder activity

---

## Neynar Pricing & Rate Limits

### Rate Limits by Plan

| Plan | Per-Endpoint | Global Limit | Special Endpoints* |
|------|--------------|--------------|-------------------|
| **Starter** | 300 RPM / 5 RPS | 500 RPM | 5k RPM |
| **Growth** | 600 RPM / 10 RPS | 1000 RPM | 10k RPM |
| **Scale** | 1200 RPM / 20 RPS | 2000 RPM | 20k RPM |
| **Enterprise** | Custom | Custom | Custom |

*Special endpoints: Frame validation, signer endpoints (high-traffic)

### Pricing Structure

| Plan | Credits/Month | Cost | Free Tier |
|------|---------------|------|-----------|
| **Starter** | 1M credits | TBD | ✅ Start for free |
| **Growth** | 10M credits | TBD | ✅ Start for free |
| **Scale** | 60M credits | TBD | ✅ Start for free |
| **Enterprise** | Custom | Custom | Contact sales |

**Note:** All plans include "Start for free" option with:
- Webhooks
- Hub endpoint
- Indexer-as-a-service
- All Read and Write APIs

**Growth/Scale add:**
- Hosted SQL playground
- Custom tables/data pipelines

**Important:** Rate limits are independent of credit usage. Going over credits doesn't trigger rate limits.

Source: [Neynar Rate Limits Documentation](https://docs.neynar.com/reference/what-are-the-rate-limits-on-neynar-apis)

---

## Recommended Oracle Templates Using Neynar

### 1. Farcaster Influencer Tracker ⭐⭐⭐⭐⭐

**What it tracks:**
- Top Farcaster users by followers
- Engagement rates (likes/recasts per cast)
- Growth rates (new followers/day)

**Use cases:**
- Social trading signals
- Influencer marketing
- Community health metrics

**Data structure:**
```typescript
interface InfluencerData {
  fid: number;
  username: string;
  followers: number;
  follower_growth_7d: number;
  avg_engagement_rate: number;
  verified_addresses: string[];
}
```

**API calls:**
- `/user/bulk` - Fetch user profiles
- `/user/followers` - Get follower counts
- `/casts` - Calculate engagement

**Rate limit impact:** ~10 requests per update
**Recommended frequency:** 1 hour

---

### 2. Token Mention Sentiment Tracker ⭐⭐⭐⭐⭐

**What it tracks:**
- Mentions of specific tokens (e.g., $DEGEN, $BRETT)
- Sentiment analysis of casts
- Viral velocity of token discussions

**Use cases:**
- Social trading signals
- Token launch monitoring
- Community sentiment

**Data structure:**
```typescript
interface TokenMentions {
  token_symbol: string;
  mentions_24h: number;
  positive_sentiment: number; // 0-1
  trending_rank: number;
  top_casts: Cast[];
  engagement_score: number;
}
```

**API calls:**
- `/cast/search` - Search for token mentions
- `/cast/reactions` - Get engagement metrics
- `/feed/trending` - Check if token is trending

**Rate limit impact:** ~20 requests per update
**Recommended frequency:** 15 minutes

---

### 3. Channel Activity Monitor ⭐⭐⭐⭐

**What it tracks:**
- Activity in crypto/DeFi channels
- New members joining
- Cast volume and engagement

**Use cases:**
- Community growth tracking
- Topic trend detection
- Channel health metrics

**Data structure:**
```typescript
interface ChannelActivity {
  channel_id: string;
  channel_name: string;
  member_count: number;
  casts_24h: number;
  active_users_24h: number;
  trending_casts: Cast[];
}
```

**API calls:**
- `/channel` - Fetch channel data
- `/feed/channel` - Get channel feed
- `/channel/followers` - Member count

**Rate limit impact:** ~15 requests per update
**Recommended frequency:** 30 minutes

---

### 4. Whale Social Activity Tracker ⭐⭐⭐⭐⭐

**What it tracks:**
- Farcaster activity from known whale wallets
- When whales follow new projects
- Whale engagement with tokens

**Use cases:**
- Follow smart money
- Early project detection
- Whale signal alerts

**Data structure:**
```typescript
interface WhaleActivity {
  fid: number;
  username: string;
  verified_address: string;
  recent_casts: Cast[];
  new_follows: number[]; // FIDs they followed
  tokens_mentioned: string[];
}
```

**API calls:**
- `/user/search` - Find users by ETH address
- `/casts/user` - Get recent casts
- `/user/following` - Track new follows

**Rate limit impact:** ~25 requests per update (10 whales)
**Recommended frequency:** 5 minutes (for alerts)

---

### 5. Viral Cast Detector ⭐⭐⭐⭐⭐

**What it tracks:**
- Fast-growing casts (viral velocity)
- Breakout content
- Trending topics

**Use cases:**
- Content discovery
- Trend prediction
- Alpha hunting

**Data structure:**
```typescript
interface ViralCast {
  hash: string;
  text: string;
  author_fid: number;
  created_at: number;
  likes: number;
  recasts: number;
  replies: number;
  viral_velocity: number; // engagement per hour
  growth_rate: number; // % increase in last hour
}
```

**API calls:**
- `/feed/trending` - Get trending feed
- `/cast` - Fetch cast details
- `/cast/reactions` - Get engagement metrics

**Rate limit impact:** ~30 requests per update
**Recommended frequency:** 5 minutes

---

### 6. New User/Project Launch Detector ⭐⭐⭐⭐

**What it tracks:**
- New Farcaster accounts
- First casts from new users
- Verified address additions

**Use cases:**
- New project discovery
- Bot detection
- Community growth

**Data structure:**
```typescript
interface NewAccount {
  fid: number;
  username: string;
  created_at: number;
  verified_addresses: string[];
  first_cast: Cast | null;
  follower_velocity: number; // how fast gaining followers
}
```

**API calls:**
- `/user/search` - Find recent users
- `/casts/user` - Get first casts

**Rate limit impact:** ~15 requests per update
**Recommended frequency:** 1 hour

---

## Integration Architecture

### Oracle Flow with Neynar

```
FEEDS Oracle (Cloudflare Worker)
↓
Neynar REST API
  - /feed/trending
  - /cast/search
  - /user/bulk
  - /channel
↓
Data Aggregation & Processing
  - Calculate engagement rates
  - Sentiment analysis
  - Ranking algorithms
↓
Format for Smart Contract
  - Encode as bytes
  - Include timestamp
  - Add validator signature
↓
Submit to Oracle Contract on Base
↓
Emit event for dApps to consume
```

### Webhook Integration (Real-Time)

```
Neynar Webhook
↓
FEEDS Webhook Handler (Cloudflare Worker)
↓
Filter & Process Event
  - cast.created with specific keywords
  - user.followed for whale tracking
  - reaction.created for viral detection
↓
Update Oracle Contract Immediately
↓
Emit event for real-time dApp updates
```

---

## Rate Limit Strategy for FEEDS

### Starter Plan (Free Tier)
**Limits:** 300 RPM per endpoint, 500 RPM global

**Oracles we can support:**
- 5-10 oracle templates running every 5-15 minutes
- ~100-150 requests/hour total
- Perfect for beta launch

**Recommended templates:**
1. Token Mention Tracker (15 min intervals)
2. Channel Activity Monitor (30 min intervals)
3. Influencer Tracker (1 hour intervals)

### Growth Plan ($X/month)
**Limits:** 600 RPM per endpoint, 1000 RPM global

**Oracles we can support:**
- 20-30 oracle templates
- Real-time viral detection (5 min intervals)
- Whale tracking with alerts
- ~300-400 requests/hour

### Scale Plan ($XX/month)
**Limits:** 1200 RPM per endpoint, 2000 RPM global

**Oracles we can support:**
- 50+ oracle templates
- Real-time webhooks for instant updates
- High-frequency monitoring (1 min intervals)
- ~800-1000 requests/hour

---

## Cost Optimization Strategies

### 1. Caching Strategy
```typescript
// Cache Neynar responses in Cloudflare KV
const CACHE_TTL = {
  user_profiles: 3600,      // 1 hour
  trending_feed: 300,       // 5 minutes
  cast_details: 1800,       // 30 minutes
  channel_data: 1800,       // 30 minutes
};
```

### 2. Batch Requests
```typescript
// Use bulk endpoints when available
const users = await neynar.user.bulk([fid1, fid2, fid3]); // 1 request
// Instead of:
// const user1 = await neynar.user.get(fid1); // 3 requests
// const user2 = await neynar.user.get(fid2);
// const user3 = await neynar.user.get(fid3);
```

### 3. Webhooks > Polling
```typescript
// Use webhooks for real-time data instead of polling
await neynar.webhook.create({
  url: 'https://feeds.review/webhook/farcaster',
  events: ['cast.created', 'reaction.created']
});
// This eliminates constant polling = huge rate limit savings
```

### 4. Smart Update Frequencies
```typescript
const UPDATE_INTERVALS = {
  viral_detection: 5 * 60,      // 5 min - needs freshness
  influencer_stats: 60 * 60,    // 1 hour - slow changing
  channel_activity: 30 * 60,    // 30 min - moderate
  whale_tracking: 10 * 60,      // 10 min - important but not urgent
};
```

---

## Recommended Implementation Plan

### Phase 1: MVP (Starter Plan - Free)
1. ✅ **Token Mention Tracker** - Most requested feature
2. ✅ **Influencer Tracker** - Easy win, high value
3. ✅ **Channel Activity** - Community health

**Expected usage:** ~150 requests/hour
**Cost:** $0 (free tier)

### Phase 2: Growth (Growth Plan)
4. ✅ **Viral Cast Detector** - Needs more frequent updates
5. ✅ **Whale Social Tracker** - Higher request volume
6. ✅ **New Project Detector** - More comprehensive scanning

**Expected usage:** ~350 requests/hour
**Cost:** TBD (check dev.neynar.com/pricing)

### Phase 3: Scale (Scale Plan)
7. ✅ **Real-time webhooks** - Instant oracle updates
8. ✅ **Custom SQL queries** - Advanced analytics
9. ✅ **Multi-channel monitoring** - 10+ channels simultaneously

**Expected usage:** ~800 requests/hour
**Cost:** TBD (check dev.neynar.com/pricing)

---

## SDK Integration Example

### Node.js SDK
```typescript
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const client = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY });

// Fetch trending casts
const trending = await client.fetchTrendingFeed({ limit: 25 });

// Search for token mentions
const mentions = await client.searchCasts({
  q: "$DEGEN",
  limit: 100
});

// Get user profile
const user = await client.lookupUserByUsername({ username: "dwr.eth" });

// Batch fetch users
const users = await client.fetchBulkUsers({ fids: [1, 2, 3] });
```

---

## Comparison: Neynar vs Direct Farcaster

| Feature | Neynar | Direct Farcaster |
|---------|--------|------------------|
| REST API | ✅ Full API | ⚠️ Limited |
| Webhooks | ✅ Built-in | ❌ Build yourself |
| Indexed queries | ✅ Fast | ⚠️ Slower |
| Search | ✅ Full-text | ⚠️ Basic |
| Onchain data | ✅ Integrated | ❌ Separate |
| SDKs | ✅ Multiple | ⚠️ Community |
| Rate limits | ✅ Clear tiers | ⚠️ Unclear |
| Free tier | ✅ Yes | ✅ Yes |
| Cost | TBD per plan | Free |

**Verdict:** Neynar is worth it for production oracles. Better performance, easier integration, more features.

---

## Next Steps

1. **Sign up for Neynar** - Get free API key at [dev.neynar.com](https://dev.neynar.com)
2. **Test token mention tracker** - Build first oracle template
3. **Measure rate limit usage** - See if free tier is sufficient
4. **Implement caching** - Optimize request usage
5. **Add webhooks** - For real-time oracles
6. **Upgrade if needed** - Based on user demand

---

## Sources

- [Neynar Documentation](https://docs.neynar.com)
- [Neynar Rate Limits](https://docs.neynar.com/reference/what-are-the-rate-limits-on-neynar-apis)
- [Neynar SDK Guide](https://medium.com/coinmonks/how-to-use-the-neynar-sdk-to-build-on-farcaster-webhooks-casts-user-info-a71ec4cbd00d)
- [Neynar GitHub](https://github.com/neynarxyz)
- [Farcaster Third-Party Tools](https://docs.farcaster.xyz/reference/third-party/neynar)
