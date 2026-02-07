# Validator Deployment Guide

## Overview

This guide will help you deploy the updated validators with Farcaster oracle support to Cloudflare Workers.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed: `npm install -g wrangler`
- Logged into Wrangler: `wrangler login`
- Validator private keys (already configured as secrets)

## What Changed

### Updated Validator Features

1. **Farcaster Oracle Support**
   - Added `FARCASTER_ORACLE_ABI` for interacting with FarcasterOracle contracts
   - New `fetchFarcasterMetrics()` function to fetch data from Neynar API
   - Sentiment analysis using positive/negative keyword detection
   - Social metrics calculation (mentions, engagement, unique users)

2. **Neynar API Integration**
   - Environment variable: `NEYNAR_API_KEY`
   - Searches Farcaster casts for token mentions
   - Calculates real-time social metrics
   - Identifies top performing casts

3. **Multi-Oracle Type Support**
   - Detects oracle type from registry
   - Routes to appropriate validation function
   - Supports: `price`, `farcaster`, `weather`

4. **Updated Configuration**
   - Registry address updated to: `0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64`
   - RPC URL updated to: `https://base-rpc.publicnode.com`

## Deployment Steps

### Step 1: Navigate to Workers Directory

```bash
cd /Users/chadneal/Desktop/feeds.review/workers
```

### Step 2: Deploy Updated Validators

Run the deployment script:

```bash
./deploy-validators.sh
```

This will deploy all 5 validators to Cloudflare Workers.

**Expected output**:
```
🚀 Deploying FEEDS validators to Cloudflare Workers...

Deploying validator-1...
✅ Published feeds-validator-1 (X.XX sec)
  https://feeds-validator-1.see21289.workers.dev

Deploying validator-2...
✅ Published feeds-validator-2 (X.XX sec)
...
```

### Step 3: Set Neynar API Key

Run the update script to add the Neynar API key to all validators:

```bash
./update-validators.sh
```

This will prompt you to set the secret for each validator. The script uses your Neynar API key: `C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C`

**Alternative manual method** (if script doesn't work):

```bash
# Set for each validator individually
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-1
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-2
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-3
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-4
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-5
```

### Step 4: Verify Deployment

#### Check Health Endpoints

```bash
# Check all validators
curl https://feeds-validator-1.see21289.workers.dev/health
curl https://feeds-validator-2.see21289.workers.dev/health
curl https://feeds-validator-3.see21289.workers.dev/health
curl https://feeds-validator-4.see21289.workers.dev/health
curl https://feeds-validator-5.see21289.workers.dev/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "validator": "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
  "configured": {
    "privateKey": true,
    "rpc": true,
    "registry": true
  },
  "timestamp": 1737504000000
}
```

#### Check via API Studio

Visit: http://localhost:3000/api-studio

1. Select "GET /api/v1/validators"
2. Click "EXECUTE"
3. All 5 validators should show `"status": "online"` and `"healthy": true`

## Testing Farcaster Oracle

### Step 1: Deploy a Farcaster Oracle

1. Visit: http://localhost:3000/create-oracle
2. Connect wallet
3. Select "FARCASTER SOCIAL DATA"
4. Enter:
   - Name: `DEGEN-SOCIAL-METRICS`
   - Target Token: `DEGEN`
   - Update Frequency: 60 minutes
   - Consensus: 66%
5. Deploy (pay gas fees)
6. Wait for confirmation

### Step 2: Monitor Validator Activity

After deployment, validators will start monitoring the oracle. On the next cron run (every minute), they will:

1. Detect the new Farcaster oracle
2. Check if it needs an update
3. Fetch Farcaster data from Neynar
4. Calculate social metrics
5. Submit metrics to the oracle

**Check validator logs** (in Cloudflare dashboard):
```
Fetching Farcaster metrics for $DEGEN
Found 87 casts for $DEGEN
Submitting metrics to oracle...
Transaction confirmed: 0x...
```

### Step 3: View Results in API Studio

1. Visit: http://localhost:3000/api-studio
2. Select "GET /api/v1/farcaster/{address}"
3. Enter your oracle address
4. Click "EXECUTE"

**Expected response**:
```json
{
  "success": true,
  "oracle": {
    "address": "0x...",
    "name": "DEGEN-SOCIAL-METRICS",
    "targetToken": "DEGEN",
    "latestMetrics": {
      "mentions24h": 87,
      "sentimentScore": 3500,
      "sentimentLabel": "Positive",
      "engagementRate": 1250,
      "engagementRatePercent": "12.50%",
      "uniqueUsers": 45,
      "totalEngagement": 1089,
      "topCastFid": 123456
    },
    "submissions": {
      "count": 4,
      "required": 4
    }
  }
}
```

## Troubleshooting

### Validators showing "offline"

**Check**:
1. Cloudflare Workers deployed successfully
2. Private keys configured as secrets
3. Validators have ETH for gas (0.01 ETH each)

**Solution**:
```bash
# Re-deploy validators
./deploy-validators.sh

# Check validator status endpoint
curl https://feeds-validator-1.see21289.workers.dev/status
```

### "Neynar API key not configured" error

**Check**:
```bash
# List secrets for validator-1
wrangler secret list --env validator-1
```

**Solution**:
```bash
# Re-add Neynar API key
echo "C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C" | wrangler secret put NEYNAR_API_KEY --env validator-1
```

### No metrics being submitted

**Check**:
1. Oracle deployed correctly
2. Oracle address registered in OracleRegistry
3. Cron triggers enabled (free tier allows 5 total)

**Solution**:
```bash
# Manually trigger validation
curl -X POST https://feeds-validator-1.see21289.workers.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"oracleAddress": "0x..."}'
```

### Sentiment always returning 0

This is normal if:
- Casts don't contain positive/negative keywords
- Token has neutral sentiment
- Not enough data yet

**Check**: View raw Neynar data:
```bash
curl "https://api.neynar.com/v2/farcaster/cast/search?q=\$DEGEN&limit=10" \
  -H "api_key: C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C"
```

## Monitoring

### Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Navigate to: Workers & Pages
3. Select validator (e.g., `feeds-validator-1`)
4. View logs, metrics, and cron runs

### API Monitoring

```bash
# Check all validators health
curl http://localhost:3000/api/v1/validators

# Watch validator submissions
watch -n 30 'curl http://localhost:3000/api/v1/validators | jq .summary'
```

### Oracle Monitoring

```bash
# Check oracle status
curl http://localhost:3000/api/v1/farcaster/0x... | jq

# Watch submissions count
watch -n 10 'curl http://localhost:3000/api/v1/farcaster/0x... | jq .oracle.submissions.count'
```

## Validator Behavior

### Cron Schedule

Validators run **every minute** to check all oracles. For each oracle:

1. Check if oracle needs update (based on `updateFrequency`)
2. If yes, fetch appropriate data (price, farcaster, or weather)
3. Submit data to oracle contract
4. Wait for consensus (4 out of 5 validators)
5. Oracle updates `latestMetrics` with median values

### Gas Management

Each validator:
- Funded with 0.01 ETH
- Uses ~0.0001-0.0002 ETH per submission
- Can handle ~50-100 submissions before needing refill
- Monitor balance via `/status` endpoint

### Rate Limits

**Neynar API** (Free Tier):
- 300 requests per minute
- Each validator makes 1 request per oracle per update
- 5 validators × 1 oracle × 1 minute = 5 requests/min
- Safe for ~60 Farcaster oracles

**Base RPC**:
- PublicNode: No rate limits
- Cloudflare protected: auto-retries

## Next Steps

1. ✅ Deploy validators with updated code
2. ✅ Set Neynar API key secrets
3. ✅ Verify all validators healthy
4. ✅ Deploy test Farcaster oracle
5. ✅ Monitor first submission
6. ✅ Verify consensus achieved
7. 🎉 System fully operational!

## Support

- **Validator Issues**: Check Cloudflare dashboard logs
- **Oracle Issues**: Use API Studio to test endpoints
- **Neynar Issues**: Check API response directly
- **Contract Issues**: View on BaseScan

---

**All validators updated and ready for Farcaster oracle support!** 🚀
