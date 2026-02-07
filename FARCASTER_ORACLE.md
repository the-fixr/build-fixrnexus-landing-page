# FarcasterOracle - Social Metrics Oracle

## Overview

FarcasterOracle is a specialized oracle contract designed to track social metrics for tokens on Farcaster using the Neynar API. Unlike PriceOracle which tracks numeric price data, FarcasterOracle tracks social engagement, sentiment, and activity metrics.

## Deployed Contracts

### Base Mainnet
- **OracleRegistry**: `0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64`
- **OracleFactory** (Updated): `0xBe17f562BF4068fb429D7729D0EAa64cEBf3ed88`
  - Deployed: January 2026
  - Supports both `deployPriceOracle()` and `deployFarcasterOracle()`

## Contract Structure

### SocialMetrics Data Structure

```solidity
struct SocialMetrics {
    uint256 mentions24h;        // Number of mentions in last 24 hours
    int256 sentimentScore;      // Sentiment: -10000 to +10000 (basis points)
    uint256 engagementRate;     // Engagement in basis points (e.g., 1550 = 15.5%)
    uint256 uniqueUsers;        // Number of unique users mentioning
    uint256 totalEngagement;    // Total likes + recasts + replies
    uint256 topCastFid;         // FID of the top performing cast
    uint256 timestamp;
}
```

### Key Functions

#### For Validators

```solidity
function submitMetrics(
    uint256 _mentions24h,
    int256 _sentimentScore,
    uint256 _engagementRate,
    uint256 _uniqueUsers,
    uint256 _totalEngagement,
    uint256 _topCastFid
) external nonReentrant
```

Validators submit social metrics they fetch from Neynar API. When enough validators (based on consensus threshold) submit data, the contract calculates consensus using median values.

#### Public View Functions

```solidity
function getLatestMetrics() external view returns (SocialMetrics memory)
function getCurrentSubmissionCount() external view returns (uint256)
function getSubmission(uint256 index) external view returns (Submission memory)
```

## Deployment

### Via Frontend (User-Paid)

Users can deploy Farcaster oracles through the UI at `/create-oracle`:

1. Connect wallet
2. Select "Farcaster Social Data" template
3. Configure:
   - Oracle name (e.g., "DEGEN Social Metrics")
   - Token symbol (e.g., "$DEGEN")
   - Target token for tracking
   - Update frequency (e.g., 1 hour)
   - Consensus threshold (e.g., 66%)
4. Click "Deploy Oracle" - user pays gas fees
5. Contract is deployed and registered automatically

### Via Smart Contract

```solidity
// From OracleFactory
function deployFarcasterOracle(
    string memory _name,
    string memory _symbol,
    string memory _targetToken,    // e.g., "DEGEN" or "$DEGEN"
    uint8 _consensusThreshold,     // 51-100 (percentage)
    uint256 _updateFrequency       // seconds between updates
) external returns (address)
```

**Example**:
```javascript
const factory = new ethers.Contract(
  '0xBe17f562BF4068fb429D7729D0EAa64cEBf3ed88',
  factoryAbi,
  signer
);

const tx = await factory.deployFarcasterOracle(
  'DEGEN Social Metrics',
  'DEGEN-SOCIAL',
  'DEGEN',
  66,      // 66% consensus
  3600     // 1 hour updates
);

const receipt = await tx.wait();
const event = receipt.logs.find(e => e.name === 'OracleDeployed');
const oracleAddress = event.args.oracleAddress;
```

## Validator Integration

### Neynar API Data Fetching

Validators fetch data from Neynar API endpoints:

**Endpoints Used**:
- `GET /v2/farcaster/casts/search` - Search for token mentions
- `GET /v2/farcaster/cast` - Get cast details for engagement
- `GET /v2/farcaster/reactions` - Get reactions/engagement data

**Example Flow**:

```javascript
// 1. Search for casts mentioning the token
const searchResponse = await fetch(
  `https://api.neynar.com/v2/farcaster/casts/search?query=${targetToken}&limit=100`,
  {
    headers: { 'api_key': NEYNAR_API_KEY }
  }
);

const casts = await searchResponse.json();

// 2. Calculate metrics
const metrics = {
  mentions24h: casts.result.casts.filter(c =>
    Date.now() - new Date(c.timestamp) < 86400000
  ).length,

  uniqueUsers: new Set(casts.result.casts.map(c => c.author.fid)).size,

  totalEngagement: casts.result.casts.reduce((sum, cast) =>
    sum + cast.reactions.likes_count +
    cast.reactions.recasts_count +
    cast.replies.count, 0
  ),

  engagementRate: calculateEngagementRate(casts),
  sentimentScore: calculateSentiment(casts),
  topCastFid: findTopCast(casts).author.fid
};

// 3. Submit to oracle
await oracle.submitMetrics(
  metrics.mentions24h,
  metrics.sentimentScore,
  metrics.engagementRate,
  metrics.uniqueUsers,
  metrics.totalEngagement,
  metrics.topCastFid
);
```

### Sentiment Calculation

Sentiment score is -10000 to +10000 (basis points):
- **Positive keywords**: bullish, moon, gem, based, LFG, etc. (+points)
- **Negative keywords**: bearish, scam, rug, dump, etc. (-points)
- **Neutral**: 0

Example:
```javascript
function calculateSentiment(casts) {
  const positiveWords = ['bullish', 'moon', 'gem', 'based', 'lfg'];
  const negativeWords = ['bearish', 'scam', 'rug', 'dump'];

  let score = 0;
  casts.forEach(cast => {
    const text = cast.text.toLowerCase();
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 100;
    });
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 100;
    });
  });

  // Normalize to -10000 to +10000 range
  return Math.max(-10000, Math.min(10000, score * 10));
}
```

## Consensus Mechanism

FarcasterOracle uses **median consensus** for all numeric fields:

1. Validators submit their metrics
2. When threshold is met (e.g., 4 out of 5 validators = 80% > 66%)
3. Contract calculates median for each field:
   - `mentions24h` → median of all submissions
   - `sentimentScore` → median of all submissions
   - `engagementRate` → median of all submissions
   - `uniqueUsers` → median of all submissions
   - `totalEngagement` → median of all submissions
   - `topCastFid` → median of all submissions

**Why median?**
- Resistant to outliers (one validator's bad data won't skew results)
- Works well for social metrics which can vary between sources
- Fair representation of consensus

## API Access

### Get Latest Metrics

```bash
curl http://localhost:3000/api/v1/farcaster/{oracleAddress}
```

**Response**:
```json
{
  "success": true,
  "oracle": {
    "address": "0x...",
    "name": "DEGEN Social Metrics",
    "symbol": "DEGEN-SOCIAL",
    "targetToken": "DEGEN",
    "latestMetrics": {
      "mentions24h": 1234,
      "sentimentScore": 3500,
      "sentimentLabel": "Positive",
      "engagementRate": 1550,
      "engagementRatePercent": "15.5%",
      "uniqueUsers": 456,
      "totalEngagement": 7890,
      "topCastFid": 123456,
      "timestamp": 1705234567
    },
    "consensusThreshold": 66,
    "updateFrequency": 3600,
    "lastUpdate": 1705234567,
    "needsUpdate": false,
    "submissions": {
      "count": 4,
      "required": 4,
      "data": [...]
    }
  }
}
```

## Use Cases

### 1. Token Sentiment Tracking

Monitor how the Farcaster community feels about a token in real-time:
- Track mention volume spikes
- Detect sentiment shifts before price moves
- Identify influencer engagement

### 2. Marketing Analytics

Track effectiveness of marketing campaigns:
- Measure mention increases after announcements
- Monitor engagement rate changes
- Find top performing content

### 3. Community Health Metrics

Gauge community strength:
- Growing unique users = healthy community
- High engagement rate = active community
- Positive sentiment = bullish outlook

### 4. Trading Signals

Use social metrics for trading:
- Sudden mention spikes = potential price movement
- Sentiment flips = trend changes
- High engagement = increased liquidity

## Differences from PriceOracle

| Feature | PriceOracle | FarcasterOracle |
|---------|-------------|-----------------|
| Data Type | `uint256 price` | `SocialMetrics struct` |
| Use Case | Token prices | Social engagement |
| Data Source | DEX APIs | Neynar/Farcaster |
| Consensus | Median price | Median of all metrics |
| Update Trigger | Price deviation | Time-based |
| Precision | 8 decimals | Integers + basis points |

## Next Steps

### For Users
1. Deploy a FarcasterOracle for your token via `/create-oracle`
2. Monitor metrics via API Studio at `/api-studio`
3. Integrate metrics into your app/dashboard

### For Developers
1. Update validator workers to fetch Neynar data
2. Implement sentiment analysis algorithms
3. Create API endpoint for Farcaster oracle data
4. Build dashboard UI for displaying social metrics

## Validator Configuration

Each of the 5 validators needs:
- **Neynar API Key**: For fetching Farcaster data
- **Target Token**: Token symbol to track (from oracle config)
- **Update Cron**: Scheduled job matching oracle's update frequency

**Required Environment Variables** (Cloudflare Workers):
```env
NEYNAR_API_KEY=your_neynar_key
BASE_RPC_URL=https://base-rpc.publicnode.com
VALIDATOR_PRIVATE_KEY=0x...
ORACLE_REGISTRY=0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64
```

## Support

- **Contract Issues**: Check BaseScan for transaction errors
- **Validator Issues**: Monitor `/api/v1/validators` endpoint
- **Data Issues**: Verify Neynar API is returning valid data
- **API Issues**: Test endpoints via API Studio

## Resources

- **Neynar Docs**: https://docs.neynar.com
- **OracleFactory**: https://basescan.org/address/0xBe17f562BF4068fb429D7729D0EAa64cEBf3ed88
- **OracleRegistry**: https://basescan.org/address/0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64
- **API Studio**: http://localhost:3000/api-studio
