# Oracle Template Updates & Beta Pricing

## Changes Made

### 1. Oracle Templates - Replaced Weather with Farcaster/Neynar

#### Updated Oracle Types ([app/create-oracle/page.tsx](app/create-oracle/page.tsx))

**Before:**
- Price Oracle
- Weather Oracle ❌
- Custom Oracle

**After:**
- Token Price Feed
- Farcaster Social Data ⭐ NEW
- DEX Liquidity Tracker ⭐ NEW
- Custom Oracle

#### New Template: Farcaster Social Data

```typescript
{
  type: 'farcaster',
  title: 'FARCASTER SOCIAL DATA',
  description: 'Token sentiment, influencer tracking, and viral content',
  icon: Zap,
  features: [
    'Neynar API',
    'Token mentions',
    'Engagement metrics',
    'Whale tracking'
  ]
}
```

**Data Sources:**
- Neynar API (primary)
- Neynar Webhooks (real-time events)

**Use Cases:**
- Track $DEGEN, $BRETT mentions
- Monitor influencer activity
- Detect viral casts
- Social trading signals

#### New Template: DEX Liquidity Tracker

```typescript
{
  type: 'liquidity',
  title: 'DEX LIQUIDITY TRACKER',
  description: 'Monitor pool TVL, volume, APR, and LP positions',
  icon: Cloud,
  features: [
    'Pool metrics',
    'Volume tracking',
    'APR calculation',
    'Multi-DEX support'
  ]
}
```

**Data Sources:**
- GeckoTerminal (pool data)
- Dex Screener (multi-DEX)
- DefiLlama (TVL analytics)

**Use Cases:**
- Auto-compounding vaults
- LP position management
- Risk assessment

#### Updated Data Sources

**Token Price Feed:**
- GeckoTerminal (was primary)
- Dex Screener ⭐ NEW
- Uniswap Subgraph ⭐ NEW (replaces Chainlink/Pyth)

---

### 2. Subscription Manager Beta Updates

#### Added Beta Access Banner

New prominent banner at top of subscription page:

```tsx
<div className="border-2 border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 p-4 mb-6">
  <h3 className="text-lg font-bold text-[rgb(0,255,136)]">
    🎉 BETA ACCESS - ALL FEATURES FREE
  </h3>
  <p className="text-sm text-gray-400">
    During beta, all users get Pro-tier features for free.
    Pricing activates Q2 2026.
  </p>
</div>
```

#### Greyed Out Paid Tiers

**Visual Changes:**
- 60% opacity on Starter, Pro tiers
- Prices shown with strikethrough
- "FREE during beta" in green below crossed-out price
- "Q2 2026" badge in top-right corner
- $FEEDS discount pricing hidden during beta

**Before:**
```
Starter - $29/month
Pro - $99/month
```

**After:**
```
Starter - $̶2̶9̶/month
         FREE during beta
         [Q2 2026]

Pro - $̶9̶9̶/month
      FREE during beta
      [Q2 2026]
```

---

## What Users See Now

### Oracle Creation Flow

**Step 1: Select Oracle Type**

Users now see 4 template options:
1. **Token Price Feed** - DEX price aggregation
2. **Farcaster Social Data** - Neynar-powered social metrics ⭐
3. **DEX Liquidity Tracker** - Pool TVL, volume, APR ⭐
4. **Custom Oracle** - Build your own

**Step 2: Data Source Configuration**

For Farcaster oracles:
- Primary: Neynar API
- Backup: Neynar Webhooks (real-time)

For Liquidity oracles:
- Primary: GeckoTerminal
- Backup: Dex Screener or DefiLlama

### Subscription Page

**Beta Banner (Top):**
Large green banner announcing free beta access

**Current Plan Section:**
Shows actual usage with pricing crossed out for paid tiers

**Available Plans Grid:**
- Free tier: Normal display, accessible
- Starter: Greyed out, shows $29 crossed out, "FREE during beta"
- Pro: Greyed out, shows $99 crossed out, "FREE during beta"
- Enterprise: Normal display, "Contact Sales"

---

## Oracle Template Details

### Farcaster Social Data Oracle

**What it tracks:**
```typescript
interface FarcasterMetrics {
  token_symbol: string;           // e.g., "DEGEN"
  mentions_24h: number;           // Total mentions
  sentiment_score: number;        // -1 to 1
  engagement_rate: number;        // Likes + recasts / mentions
  trending_rank: number;          // Position in trending
  top_influencers: string[];      // FIDs or usernames
  viral_casts: Cast[];            // Top performing casts
}
```

**Update frequency options:**
- 5 minutes - High frequency (recommended)
- 15 minutes - Medium frequency
- 1 hour - Low frequency

**API calls per update:**
- Search casts for token mentions: ~5 calls
- Fetch engagement metrics: ~5 calls
- Get influencer data: ~5 calls
- Total: ~15 calls per update

**Monthly API usage estimates:**
- 5 min updates: ~8,640 calls/month
- 15 min updates: ~2,880 calls/month
- 1 hour updates: ~720 calls/month

**Fits in Neynar free tier:** ✅ Yes (300 RPM limit)

### DEX Liquidity Oracle

**What it tracks:**
```typescript
interface LiquidityMetrics {
  pool_address: string;
  token0: string;
  token1: string;
  tvl_usd: number;               // Total value locked
  volume_24h: number;            // 24h trading volume
  fees_24h: number;              // 24h fees generated
  apr: number;                   // Annual percentage rate
  price_change_24h: number;      // Price movement %
  liquidity_change_24h: number;  // TVL change %
}
```

**Update frequency options:**
- 1 minute - Ultra high frequency (expensive)
- 5 minutes - High frequency (recommended)
- 15 minutes - Medium frequency
- 1 hour - Low frequency

**API calls per update:**
- Fetch pool data: ~3 calls
- Calculate APR: ~2 calls
- Get 24h metrics: ~3 calls
- Total: ~8 calls per update

**Monthly API usage estimates:**
- 5 min updates: ~6,912 calls/month
- 15 min updates: ~2,304 calls/month
- 1 hour updates: ~576 calls/month

**Data sources:** All free (GeckoTerminal, Dex Screener, DefiLlama)

---

## Implementation Status

### Completed ✅
- [x] Removed weather oracle template
- [x] Added Farcaster social data template
- [x] Added DEX liquidity tracker template
- [x] Updated data source options
- [x] Added Neynar API as primary source for Farcaster
- [x] Added beta access banner to SubscriptionManager
- [x] Greyed out paid tiers with "Q2 2026" badges
- [x] Crossed out pricing with "FREE during beta"
- [x] Build verification successful

### TODO ⏳
- [ ] Implement Neynar API integration in validator worker
- [ ] Create Farcaster oracle contract template
- [ ] Create liquidity oracle contract template
- [ ] Add token mention search logic
- [ ] Add engagement calculation algorithms
- [ ] Add TVL/APR calculation logic
- [ ] Test oracle deployment end-to-end
- [ ] Sign up for Neynar API key
- [ ] Add Neynar webhook handler

---

## File Changes

### Modified Files:
1. **app/create-oracle/page.tsx**
   - Updated OracleConfig type to include 'farcaster' and 'liquidity'
   - Replaced weather template with Farcaster and Liquidity
   - Updated data source options for all oracle types
   - Added Neynar API configuration

2. **components/SubscriptionManager.tsx**
   - Added beta access banner at top
   - Added opacity-60 to paid tiers
   - Added strikethrough to pricing
   - Added "FREE during beta" text
   - Added "Q2 2026" timeline badges
   - Hidden $FEEDS discount during beta

3. **app/pricing/page.tsx** (from previous update)
   - Already has beta banner and greyed pricing

### Documentation Files:
- **NEYNAR_ORACLE_INTEGRATION.md** - Complete Neynar integration guide
- **ORACLE_STRATEGY.md** - Oracle template strategy
- **BETA_PRICING_UPDATE.md** - Beta pricing details
- **TEMPLATE_UPDATES.md** - This file

---

## User Benefits

### For Oracle Creators:
1. **More relevant templates** - Crypto/DeFi focused instead of weather
2. **Social data integration** - Unique offering via Neynar
3. **DeFi metrics** - Liquidity tracking for vaults and LP management
4. **Free beta access** - All features unlocked during testing

### For dApp Developers:
1. **Token sentiment oracles** - Social trading signals
2. **Influencer tracking** - Follow smart money on Farcaster
3. **Liquidity monitoring** - Auto-compounding vault strategies
4. **Viral content detection** - Catch trends early

---

## Next Steps

### Immediate:
1. Sign up for Neynar API (free tier)
2. Test Neynar endpoints with example token
3. Implement basic token mention search in validator
4. Deploy test oracle to Base testnet

### Short-term (1-2 weeks):
1. Build Farcaster oracle validator template
2. Build liquidity oracle validator template
3. Add oracle contract templates for both types
4. Create deployment scripts
5. End-to-end testing

### Medium-term (1 month):
1. Launch with 3 core templates (Price, Farcaster, Liquidity)
2. Add custom oracle builder (AI-assisted)
3. Monitor Neynar API usage
4. Collect user feedback
5. Iterate on templates

---

## Success Metrics

**Oracle Template Adoption:**
- Target: 50% of oracles use Farcaster or Liquidity templates
- Farcaster unique value prop vs Chainlink
- Social data = competitive advantage

**Beta User Growth:**
- Free access removes friction
- Clear pricing transparency
- Q2 2026 timeline sets expectations

**API Usage:**
- Stay within Neynar free tier (300 RPM)
- Optimize caching and request batching
- Monitor rate limit usage per oracle

---

## Summary

We've successfully:
1. ✅ Removed irrelevant weather oracle
2. ✅ Added Farcaster social data oracle (Neynar-powered)
3. ✅ Added DEX liquidity tracker oracle
4. ✅ Updated all data sources to crypto-focused APIs
5. ✅ Highlighted beta free access in SubscriptionManager
6. ✅ Greyed out future pricing with Q2 2026 timeline

**Result:** FEEDS now offers unique, crypto-native oracle templates that differentiate from Chainlink, with transparent beta pricing that encourages early adoption.
