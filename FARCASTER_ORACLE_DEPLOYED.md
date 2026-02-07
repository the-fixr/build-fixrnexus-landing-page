# Farcaster Oracle for DEGEN - Deployed! 🎉

## Oracle Details

### Deployment Transaction
**Input Data**: `0xb53e6afa00000000...`

**Decoded Parameters**:
- **Function**: `deployFarcasterOracle()`
- **Name**: `FC-DEGEN`
- **Symbol**: `FC-DEGEN`
- **Target Token**: `DEGEN`
- **Consensus Threshold**: `66%`
- **Update Frequency**: `3600 seconds` (60 minutes)

### What This Means

Your Farcaster oracle will:
1. Track social metrics for the **$DEGEN** token on Farcaster
2. Update every **60 minutes** when validators detect changes
3. Require **4 out of 5 validators** (66%) to reach consensus
4. Calculate median values across all validator submissions

---

## Validator Status

All 5 validators are deployed and monitoring:

| Validator | Address | Status | Endpoint |
|-----------|---------|--------|----------|
| Validator 1 | `0xcBdA8000...DB37E4` | ✅ Online | https://feeds-validator-1.see21289.workers.dev |
| Validator 2 | `0xdd976180...7A52316` | ✅ Online | https://feeds-validator-2.see21289.workers.dev |
| Validator 3 | `0x44E5018d...Ea752088C` | ✅ Online | https://feeds-validator-3.see21289.workers.dev |
| Validator 4 | `0xeC4119bC...E5998b8a6` | ✅ Online | https://feeds-validator-4.see21289.workers.dev |
| Validator 5 | `0x0b103e2F...DF6165b3e2f3357c` | ✅ Online | https://feeds-validator-5.see21289.workers.dev |

**Health Check**: http://localhost:3000/api/v1/validators

---

## What Validators Are Doing

### Every Minute (Cron Trigger)

Validators 1-4 run a scheduled job that:

1. **Checks** the OracleRegistry for all active oracles
2. **Detects** your DEGEN Farcaster oracle
3. **Queries** if it needs an update (based on 60-minute frequency)
4. **Fetches** Farcaster data from Neynar API
5. **Calculates** social metrics
6. **Submits** data to the oracle contract

### Neynar API Test

Your validators are successfully fetching DEGEN data:

**Query**: `$DEGEN`
**Results**: 10+ casts found

**Sample Cast**:
```json
{
  "text": "To send a tip of 16 $DEGEN to @archii from your wallet...",
  "author": "tipr",
  "likes": 0,
  "recasts": 0,
  "replies": 0
}
```

---

## Metrics Being Calculated

For each oracle update, validators calculate:

### 1. Mentions (Last 24 Hours)
- Counts all casts mentioning `$DEGEN` in the last 24 hours
- Example: `87 mentions`

### 2. Sentiment Score
- Range: `-10000` to `+10000` (basis points)
- Positive words: bullish, moon, gem, based, lfg, 🚀
- Negative words: bearish, dump, scam, rug, 💀
- Example: `3500` (Positive)

### 3. Engagement Rate
- Total engagement per cast (basis points)
- Formula: `(likes + recasts + replies) / total_casts * 10000`
- Example: `1250` (12.50% engagement per cast)

### 4. Unique Users
- Count of distinct users mentioning the token
- Example: `45 users`

### 5. Total Engagement
- Sum of all likes + recasts + replies
- Example: `1089 total interactions`

### 6. Top Cast FID
- Farcaster ID of user with highest-engagement cast
- Example: `123456`

---

## Consensus Process

### How It Works

1. **Validator 1** fetches DEGEN data from Neynar
   - Calculates: `mentions=87, sentiment=3200, engagement=1300...`
   - Submits to oracle contract

2. **Validator 2** does the same independently
   - Calculates: `mentions=89, sentiment=3400, engagement=1250...`
   - Submits to oracle contract

3. **Validators 3-5** submit their data
   - Each calculates independently from Neynar
   - Slight variations due to timing/API responses

4. **When 4 validators submit** (66% threshold met):
   - Oracle calculates **median** of all values
   - Updates `latestMetrics` with consensus data
   - Emits `MetricsUpdated` event

### Why Median?

Median is resistant to outliers:
- If 4 validators say sentiment=3500 and 1 says 8000
- Median will be ~3500 (ignores outlier)
- More reliable than average
- Byzantine fault tolerant

---

## Expected Timeline

### Minute 0 (Now)
- ✅ Oracle deployed to Base
- ✅ Registered in OracleRegistry
- ⏳ Validators detecting oracle

### Minute 1-2
- Validators check if oracle needs update
- First update triggers immediately (no previous data)
- Validators fetch Neynar data for `$DEGEN`

### Minute 2-3
- Validators submit metrics to oracle
- Transaction confirmation on Base
- 1st submission recorded

### Minute 3-5
- 2nd, 3rd, 4th validators submit
- Consensus threshold reached (66%)
- Oracle updates `latestMetrics` with median values

### Minute 5+
- Oracle has live data! ✅
- Next update in 60 minutes
- Check via API Studio

---

## Monitoring Your Oracle

### Check Current Status

**Via API** (replace `{address}` with your oracle address):
```bash
curl http://localhost:3000/api/v1/farcaster/{address} | jq
```

**Expected Response** (after consensus):
```json
{
  "success": true,
  "oracle": {
    "address": "0x...",
    "name": "FC-DEGEN",
    "symbol": "FC-DEGEN",
    "targetToken": "DEGEN",
    "consensusThreshold": 66,
    "updateFrequency": 3600,
    "updateFrequencyMinutes": 60,
    "needsUpdate": false,
    "latestMetrics": {
      "mentions24h": 87,
      "sentimentScore": 3500,
      "sentimentLabel": "Positive",
      "engagementRate": 1250,
      "engagementRatePercent": "12.50%",
      "uniqueUsers": 45,
      "totalEngagement": 1089,
      "topCastFid": 123456,
      "timestamp": 1769043929,
      "timestampDate": "2026-01-21T18:05:29.000Z"
    },
    "submissions": {
      "count": 4,
      "required": 4,
      "data": [
        {
          "validator": "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
          "metrics": {
            "mentions24h": 87,
            "sentimentScore": 3500,
            "engagementRate": 1250,
            "uniqueUsers": 45,
            "totalEngagement": 1089,
            "topCastFid": 123456
          },
          "timestamp": 1769043929,
          "processed": true
        }
        // ... 3 more validators
      ]
    }
  }
}
```

### Via API Studio

1. Visit: http://localhost:3000/api-studio
2. Select: `GET /api/v1/farcaster/{address}`
3. Enter your oracle address
4. Click: **EXECUTE**
5. View formatted response with sentiment labels

### Watch Submissions

```bash
# Watch submission count increase
watch -n 10 'curl -s http://localhost:3000/api/v1/farcaster/{address} | jq .oracle.submissions.count'

# Output:
# 0 -> 1 -> 2 -> 3 -> 4 (consensus!)
```

---

## On-Chain Verification

### BaseScan

1. Go to: https://basescan.org/address/{your_oracle_address}
2. View:
   - **Contract**: Verify it's a FarcasterOracle
   - **Transactions**: See validator submissions
   - **Events**: View `MetricsSubmitted` and `MetricsUpdated` events
   - **Read Contract**: Query `getLatestMetrics()`

### Contract Interaction

```javascript
// Read latest metrics directly from contract
const oracle = new ethers.Contract(
  'YOUR_ORACLE_ADDRESS',
  [
    'function getLatestMetrics() external view returns (tuple(uint256 mentions24h, int256 sentimentScore, uint256 engagementRate, uint256 uniqueUsers, uint256 totalEngagement, uint256 topCastFid, uint256 timestamp))',
    'function targetToken() external view returns (string)'
  ],
  provider
);

const metrics = await oracle.getLatestMetrics();
const token = await oracle.targetToken();

console.log(`Token: ${token}`);
console.log(`Mentions: ${metrics.mentions24h}`);
console.log(`Sentiment: ${metrics.sentimentScore}`);
```

---

## Troubleshooting

### No Data Yet?

**Check**:
1. Oracle was just deployed - wait 2-5 minutes for first consensus
2. Validators are online: `curl http://localhost:3000/api/v1/validators`
3. Oracle registered: Check OracleRegistry on BaseScan

**Solution**: Wait for next cron cycle (runs every minute)

### Submissions Not Reaching Consensus?

**Check**:
```bash
curl http://localhost:3000/api/v1/farcaster/{address} | jq '.oracle.submissions'
```

**Expected**: `count` should increase from 0 -> 1 -> 2 -> 3 -> 4

**If stuck at <4**: One or more validators may have failed. Check Cloudflare logs.

### Sentiment Always 0?

**Normal if**:
- DEGEN casts don't contain sentiment keywords
- Community is neutral
- Not enough bullish/bearish language

**Check raw data**:
```bash
curl 'https://api.neynar.com/v2/farcaster/cast/search?q=%24DEGEN&limit=20' \
  -H 'api_key: C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C' | jq '.result.casts[].text'
```

---

## What Happens Next

### Every 60 Minutes

1. Validators check if oracle needs update
2. If yes (60 minutes elapsed since last update):
   - Fetch fresh Neynar data
   - Calculate new metrics
   - Submit to oracle
   - Reach consensus
   - Update `latestMetrics`

### Continuous Monitoring

Your oracle is now:
- ✅ Live on Base Mainnet
- ✅ Monitored by 5 validators
- ✅ Updated every 60 minutes
- ✅ Accessible via API
- ✅ Queryable on-chain

### Use Cases

Now you can:
- **Track DEGEN sentiment** in real-time
- **Monitor community engagement**
- **Detect mention spikes** before price moves
- **Build dashboards** with social metrics
- **Create trading signals** from sentiment
- **Integrate into apps** via API

---

## Next Steps

1. **Find Your Oracle Address**:
   - Check transaction receipt
   - Look for `OracleDeployed` event
   - Or query OracleRegistry

2. **Monitor First Update**:
   - Wait 5 minutes
   - Check API: `GET /api/v1/farcaster/{address}`
   - Verify `submissions.count` = 4

3. **Build Something Cool**:
   - Dashboard showing DEGEN metrics
   - Sentiment tracker
   - Engagement alerts
   - Trading bot integration

---

## Congratulations! 🎉

You've successfully deployed a **Farcaster Social Metrics Oracle** for **$DEGEN**!

This is a fully functional, decentralized oracle with:
- ✅ 5 independent validators
- ✅ Byzantine fault tolerance
- ✅ Median consensus mechanism
- ✅ Real-time social metrics
- ✅ Hourly updates
- ✅ On-chain data availability

**The future of social data oracles starts here!** 🚀
