# FEEDS Oracle Strategy

## Validator Distribution & Uptime

### Current Setup
Based on the validator template code, validators are deployed as Cloudflare Workers, which means:

**Global Distribution:**
- ✅ Cloudflare has 300+ data centers worldwide
- ✅ Workers automatically run on edge nodes closest to requests
- ✅ Built-in global load balancing and failover
- ✅ No single region dependency

**Uptime Targets:**
- **3 nines (99.9%)**: ~8.7 hours downtime/year - **ACHIEVABLE**
- **4 nines (99.99%)**: ~52 minutes downtime/year - **REQUIRES REDUNDANCY**
- **5 nines (99.999%)**: ~5 minutes downtime/year - **ENTERPRISE ONLY**

### Achieving 99.9% Uptime

**Current Architecture:**
```
User Request → Cloudflare Edge (300+ locations)
              → Validator Worker (runs globally)
              → Data Source API (GeckoTerminal, etc.)
              → Cloudflare KV (distributed cache)
```

**Built-in Advantages:**
1. **Cloudflare's SLA**: 99.99% edge network uptime
2. **Geographic redundancy**: Automatic failover between regions
3. **DDoS protection**: Built-in at edge level
4. **Smart routing**: Traffic goes to healthy nodes only

**What We Need to Add:**
1. **Multiple data source fallbacks** - If GeckoTerminal is down, try Dex Screener
2. **Health checks** - Scheduled worker pings validators every minute
3. **Circuit breakers** - Disable failing data sources temporarily
4. **Monitoring** - Track validator response times and errors

### Multi-Region Validator Strategy

**Recommended Setup (for 99.9%):**
```javascript
// validators/crypto-price-validator.ts
const DATA_SOURCES = [
  {
    name: 'geckoterminal',
    priority: 1,
    endpoint: 'https://api.geckoterminal.com/api/v2',
    regions: ['global']
  },
  {
    name: 'dexscreener',
    priority: 2,
    endpoint: 'https://api.dexscreener.com/latest',
    regions: ['global']
  },
  {
    name: 'uniswap-subgraph',
    priority: 3,
    endpoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    regions: ['ethereum', 'base']
  }
];

// Cascade through data sources
async function fetchWithFallback(token: string) {
  for (const source of DATA_SOURCES) {
    try {
      const data = await fetchFromSource(source, token);
      if (data && data.price) return data;
    } catch (error) {
      console.error(`${source.name} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All data sources failed');
}
```

**Geographic Distribution (Cloudflare handles this automatically):**
- North America: Multiple US regions + Canada
- Europe: UK, Germany, France, Netherlands
- Asia: Singapore, Japan, India, Australia
- South America: Brazil, Chile
- Africa: South Africa, Kenya

**No manual region selection needed** - Cloudflare Workers deploy globally by default.

---

## Oracle Templates: Weather vs. Crypto/DeFi

### Why Weather is "Lame" for Crypto

You're right. Weather oracles are:
- ❌ Not relevant to DeFi/crypto use cases
- ❌ Limited on-chain utility (maybe prediction markets?)
- ❌ Boring for crypto-native users
- ❌ Not differentiated from Chainlink

### Better Oracle Ideas for Crypto/DeFi

#### **1. DeFi/Trading Oracles** (HIGH VALUE)

**DEX Liquidity Oracles:**
```typescript
interface LiquidityData {
  pool: string;
  tvl: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  impermanentLoss: number;
}
```
**Use cases:**
- Auto-compounding vault strategies
- LP position rebalancing
- Risk assessment for lending protocols

**Data sources:**
- GeckoTerminal API (already have)
- Dex Screener API
- Uniswap V3 Subgraph
- DefiLlama API

---

**Token Launch Detection:**
```typescript
interface NewToken {
  address: string;
  symbol: string;
  liquidity: number;
  createdAt: number;
  holders: number;
  rug_risk_score: number;
}
```
**Use cases:**
- Sniper bots
- Token screening tools
- Rug pull protection

**Data sources:**
- DEX screener real-time feeds
- Etherscan/Basescan contract creation events
- Token sniffer API

---

**Cross-Chain Bridge Status:**
```typescript
interface BridgeStatus {
  bridge: string;
  fromChain: string;
  toChain: string;
  available: boolean;
  estimatedTime: number;
  fees: number;
}
```
**Use cases:**
- Multi-chain dApps
- Bridge aggregators
- User routing optimization

---

#### **2. Social/Sentiment Oracles** (VIRAL POTENTIAL)

**Crypto Twitter Sentiment:**
```typescript
interface SentimentData {
  token: string;
  mentions24h: number;
  sentiment_score: number; // -1 to 1
  trending_rank: number;
  influencer_mentions: string[];
}
```
**Data sources:**
- Twitter/X API (paid)
- Farcaster (free, crypto-native)
- Lens Protocol (decentralized social)
- LunarCrush API

---

**Farcaster Activity Feed:**
```typescript
interface FarcasterFeed {
  user: string;
  casts: number;
  reactions: number;
  followers: number;
  token_mentions: { [symbol: string]: number };
}
```
**Why Farcaster?**
- Native crypto audience
- Free API access
- On-chain social graph
- Perfect for Base ecosystem

**Use cases:**
- Social trading signals
- Influencer tracking
- Community health metrics

---

#### **3. On-Chain Activity Oracles** (UNIQUE)

**Whale Wallet Tracker:**
```typescript
interface WhaleActivity {
  wallet: string;
  recentTransfers: Transfer[];
  newPositions: Position[];
  profitLoss24h: number;
  followersCount: number;
}
```
**Data sources:**
- Basescan API
- Arkham Intelligence
- Nansen API
- Zerion API

---

**Gas Price Optimizer:**
```typescript
interface GasData {
  base_fee: number;
  priority_fee: number;
  fast: number;
  standard: number;
  slow: number;
  next_block_prediction: number;
}
```
**Use cases:**
- Transaction timing optimization
- MEV protection
- Gas token hedging

**Data sources:**
- Blocknative Gas API
- EtherScan Gas Tracker
- Custom node RPC calls

---

**NFT Floor Price & Rarity:**
```typescript
interface NFTData {
  collection: string;
  floor_price: number;
  volume_24h: number;
  sales_24h: number;
  rarity_scores: { [tokenId: string]: number };
}
```
**Data sources:**
- Reservoir API
- OpenSea API
- Blur API

---

#### **4. Real-World Crypto Data** (PRACTICAL)

**CEX Funding Rates:**
```typescript
interface FundingRates {
  exchange: string;
  pair: string;
  rate: number; // % per 8h
  next_funding_time: number;
  oi_change_24h: number;
}
```
**Use cases:**
- Arbitrage opportunities
- Perpetual trading strategies
- Market sentiment indicator

**Data sources:**
- Binance API
- Bybit API
- Deribit API
- Coinglass API

---

**Stablecoin Depeg Monitor:**
```typescript
interface StablecoinHealth {
  stablecoin: string;
  peg_deviation: number; // % from $1
  volume_24h: number;
  reserve_ratio: number;
  risk_level: 'low' | 'medium' | 'high';
}
```
**Use cases:**
- Risk management
- Liquidation prevention
- Stable swap optimizers

---

## Custom vs. Template Oracles

### Template Oracles (EASY - 5 min setup)

**Complexity:** Low
**Setup time:** 5 minutes
**User skill required:** None

**How it works:**
1. User picks template (e.g., "Token Price")
2. Enters parameters (token address)
3. AI generates validator config
4. Deploy to Cloudflare Workers
5. Smart contract auto-deploys to Base

**Example templates:**
- Token Price Feed
- DEX Liquidity Tracker
- Wallet Balance Monitor
- Gas Price Feed
- NFT Floor Price

**Code structure:**
```typescript
// Template: token-price.template.ts
export const template = {
  name: 'Token Price Feed',
  params: ['tokenAddress', 'updateFrequency'],
  validator: (params) => `
    async function validate() {
      const price = await fetchTokenPrice('${params.tokenAddress}');
      return { value: price, timestamp: Date.now() };
    }
  `,
  contract: (params) => generatePriceOracleContract(params)
};
```

---

### Custom Oracles (MEDIUM - 15-30 min)

**Complexity:** Medium
**Setup time:** 15-30 minutes
**User skill required:** Basic coding or clear prompt

**How it works:**
1. User describes data need in plain English
2. AI generates custom validator code
3. User reviews/edits code (optional)
4. AI generates matching smart contract
5. Deploy both

**Difficulty comparison:**
- **Templates:** Like filling out a form
- **Custom:** Like describing what you want to ChatGPT

**Example custom prompts:**
- "Track the top 5 most-traded tokens on Uniswap V3 Base every hour"
- "Monitor when $DEGEN liquidity on Aerodrome drops below $1M"
- "Alert when any wallet accumulates >1% supply of $BRETT"
- "Aggregate NFT floor prices across OpenSea and Blur"

**What makes custom harder:**
1. AI needs to understand data structure
2. Need to find appropriate API endpoints
3. More testing required
4. Custom contract ABI

**What makes it NOT that hard:**
1. AI does 90% of the work
2. Users just describe in English
3. We provide code review/suggestions
4. Can save custom oracles as new templates

---

## Recommended Oracle Portfolio (Launch)

### Phase 1: Templates (MVP)
1. ✅ **Token Price Feed** - GeckoTerminal
2. ✅ **DEX Liquidity Tracker** - Pool TVL, volume, APR
3. ✅ **Gas Price Feed** - Base network gas estimates
4. ✅ **Wallet Balance Monitor** - Track any wallet's balance
5. ✅ **Token Holder Count** - Track holder growth

### Phase 2: Social/Viral
6. **Farcaster Activity Feed** - Crypto social signals
7. **Token Sentiment Tracker** - Social mentions + sentiment
8. **Whale Tracker** - Large wallet movements
9. **New Token Detector** - Launch monitoring

### Phase 3: Advanced DeFi
10. **Funding Rate Arbitrage** - CEX vs DEX comparison
11. **Stablecoin Health Monitor** - Depeg alerts
12. **MEV Activity Feed** - Sandwich attack tracker
13. **Bridge Monitor** - Cross-chain status

---

## Data Source Comparison

### Free APIs (Start Here)
| Source | Data | Rate Limit | Quality |
|--------|------|------------|---------|
| GeckoTerminal | DEX prices, pools | 30 req/min | ⭐⭐⭐⭐ |
| Dex Screener | Token data | Unlimited | ⭐⭐⭐⭐ |
| Farcaster | Social data | 100 req/min | ⭐⭐⭐⭐⭐ |
| Basescan | On-chain data | 5 req/sec | ⭐⭐⭐⭐⭐ |
| The Graph | Subgraph queries | 1000/day free | ⭐⭐⭐⭐ |

### Paid APIs (Upgrade Later)
| Source | Data | Cost | Worth It? |
|--------|------|------|-----------|
| Nansen | Wallet tracking | $150/mo | 🔥 YES for whale tracking |
| LunarCrush | Social sentiment | $50/mo | ⚡ YES if social focus |
| Arkham | Wallet labels | $40/mo | 💎 YES for attribution |
| Reservoir | NFT data | Free tier + $100/mo | 🎨 YES for NFT focus |
| Coinglass | Derivatives | Free tier + $30/mo | 📊 MAYBE for funding rates |

---

## Architecture: Template vs Custom

### Template Oracle Flow
```
User selects "Token Price" template
↓
Enters token address: 0xabc...
↓
AI generates validator from template:
  - Fetches from GeckoTerminal
  - Validates price format
  - Caches for 60 seconds
↓
Deploy validator to Cloudflare Worker
↓
Deploy PriceFeed.sol contract to Base
↓
User gets contract address + API endpoint
```

**Time:** ~30 seconds
**Failure rate:** <1%

---

### Custom Oracle Flow
```
User prompts: "I want to track BRETT whale wallets"
↓
AI analyzes request:
  - Identifies data: wallet balances
  - Selects API: Basescan
  - Determines threshold: >1% supply
↓
Generates custom validator:
  - Fetches top holders
  - Calculates percentages
  - Filters by threshold
  - Formats as array
↓
Generates custom contract:
  - Struct for holder data
  - Array return type
  - Update frequency setter
↓
User reviews code (optional)
↓
Deploy both
↓
User gets contract address + API endpoint
```

**Time:** ~2-5 minutes
**Failure rate:** ~5-10% (needs iteration)

---

## Recommendation

### Start With:
1. **5 solid templates** covering 80% of use cases
2. **GeckoTerminal + Dex Screener** for DEX data (free, reliable)
3. **Farcaster API** for social (crypto-native, free)
4. **Basescan** for on-chain data (free tier sufficient)

### Add Later:
- Custom oracle builder (AI-assisted)
- Paid data sources (Nansen, LunarCrush)
- Advanced templates (funding rates, MEV, etc.)

### Prioritize:
1. **Token Price Feed** - Most common need
2. **DEX Liquidity Tracker** - DeFi apps need this
3. **Farcaster Activity** - Unique, viral potential
4. **Whale Tracker** - Everyone wants to follow smart money
5. **New Token Detector** - Snipers will pay for this

**Custom oracles are only ~2-3x harder than templates**, especially with AI assistance. The real difficulty is in data source discovery and validation logic, which AI can handle well.
