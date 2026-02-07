# FEEDS Oracle System - Deployment Guide

Complete guide to deploying the FEEDS oracle infrastructure on Base network.

## Architecture Overview

The system consists of three main components:

1. **Smart Contracts** (On Base)
   - `OracleRegistry.sol` - Central registry for all oracles
   - `OracleFactory.sol` - Deploys new oracle instances
   - `PriceOracle.sol` - Individual oracle contract template

2. **Cloudflare Workers** (5 Validators)
   - Fetch data from external APIs
   - Submit data to oracle contracts
   - Participate in consensus validation

3. **Next.js Application**
   - User interface for creating/managing oracles
   - Deployment orchestration
   - Oracle monitoring dashboard

---

## Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers access
- Base network wallet with ETH for gas
- Access to Base RPC node (or use public RPC)

---

## Part 1: Deploy Smart Contracts

### Step 1: Install Dependencies

```bash
cd contracts
npm install
```

### Step 2: Configure Environment

Create `contracts/.env`:

```env
DEPLOYER_PRIVATE_KEY=your_private_key
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

### Step 3: Compile Contracts

```bash
npm run compile
```

### Step 4: Deploy Registry Contract

```bash
npm run deploy:registry
```

Save the deployed `ORACLE_REGISTRY_ADDRESS`.

### Step 5: Deploy Factory Contract

```bash
npm run deploy:factory
```

Save the deployed `ORACLE_FACTORY_ADDRESS`.

### Step 6: Verify Contracts on Basescan

```bash
npm run verify:registry -- <REGISTRY_ADDRESS>
npm run verify:factory -- <FACTORY_ADDRESS>
```

---

## Part 2: Deploy Cloudflare Workers

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare

```bash
wrangler login
```

### Step 3: Create 5 Validator Wallets

Generate 5 separate private keys for validators:

```bash
node -e "const {Wallet} = require('ethers'); for(let i=1; i<=5; i++) { const w = Wallet.createRandom(); console.log(\`Validator \${i}: \${w.address}\`); console.log(\`Private Key: \${w.privateKey}\n\`); }"
```

**IMPORTANT**: Fund each validator address with ~0.01 ETH on Base for gas fees.

### Step 4: Configure Workers

Update `workers/wrangler.toml` with your registry address:

```toml
[env.validator-1.vars]
ORACLE_REGISTRY_ADDRESS = "<YOUR_REGISTRY_ADDRESS>"
RPC_URL = "https://mainnet.base.org"
```

### Step 5: Set Secrets for Each Worker

For each validator (1-5):

```bash
# Set private key
wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-1

# Optional: Set API keys for data sources
wrangler secret put GECKOTERMINAL_API_KEY --env validator-1
wrangler secret put OPENWEATHER_API_KEY --env validator-1
```

Repeat for validator-2 through validator-5.

### Step 6: Deploy Workers

```bash
cd workers

# Deploy all 5 validators
wrangler deploy --env validator-1
wrangler deploy --env validator-2
wrangler deploy --env validator-3
wrangler deploy --env validator-4
wrangler deploy --env validator-5
```

### Step 7: Get Worker URLs

After deployment, note down all 5 worker URLs:

```
https://feeds-validator-1.<your-subdomain>.workers.dev
https://feeds-validator-2.<your-subdomain>.workers.dev
https://feeds-validator-3.<your-subdomain>.workers.dev
https://feeds-validator-4.<your-subdomain>.workers.dev
https://feeds-validator-5.<your-subdomain>.workers.dev
```

### Step 8: Register Validators in Registry Contract

Use a script or Etherscan to call `addValidator()` on the Registry contract for each validator:

```solidity
// Call 5 times with index 0-4
registry.addValidator(
    0, // index
    "0x..." // validator wallet address
    "https://feeds-validator-1...." // worker URL
);
```

---

## Part 3: Configure Factory Contract

### Set Validator Addresses in Factory

Call `setValidators()` on the Factory contract with all 5 validator addresses:

```solidity
factory.setValidators([
    "0x...", // validator 1
    "0x...", // validator 2
    "0x...", // validator 3
    "0x...", // validator 4
    "0x..."  // validator 5
]);
```

---

## Part 4: Configure Next.js Application

### Step 1: Update Environment Variables

Add to your `.env.local`:

```env
# Existing variables...

# Contract Addresses
NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS=<YOUR_REGISTRY_ADDRESS>
NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS=<YOUR_FACTORY_ADDRESS>

# Deployment
BASE_RPC_URL=https://mainnet.base.org
DEPLOYER_PRIVATE_KEY=<YOUR_DEPLOYER_KEY>

# Basescan
BASESCAN_API_KEY=<YOUR_API_KEY>
```

### Step 2: Run Database Migration

Run the updated schema in Supabase:

```bash
# Copy contents of lib/supabase/schema.sql
# Paste into Supabase SQL Editor
# Run the migration
```

### Step 3: Install Dependencies

```bash
npm install ethers
```

---

## Part 5: Test the System

### 1. Test Worker Health

```bash
curl https://feeds-validator-1.<your-subdomain>.workers.dev/health
```

Should return:
```json
{"status":"healthy","timestamp":1234567890}
```

### 2. Create Test Oracle via UI

1. Navigate to http://localhost:3000
2. Sign in
3. Click "CREATE ORACLE"
4. Configure a price oracle
5. Click "DEPLOY ORACLE"

### 3. Verify On-Chain Deployment

Check Basescan for:
- Oracle contract deployment transaction
- Registry registration event
- Factory deployment event

### 4. Monitor Validator Activity

Check worker logs:

```bash
wrangler tail --env validator-1
```

---

## Production Checklist

- [ ] All contracts deployed and verified on Basescan
- [ ] 5 Cloudflare Workers deployed and running
- [ ] All validators funded with ETH for gas
- [ ] Validators registered in Registry contract
- [ ] Factory configured with validator addresses
- [ ] Environment variables set in Next.js app
- [ ] Database schema migrated
- [ ] Test oracle deployed successfully
- [ ] Worker cron triggers active (check Cloudflare dashboard)
- [ ] Monitoring/alerting set up for validators
- [ ] Rate limiting configured on API endpoints
- [ ] CORS configured if needed

---

## Cost Estimates

### Smart Contracts (One-time)
- Registry deployment: ~$5-10
- Factory deployment: ~$3-5
- Verification: Free

### Cloudflare Workers (Monthly)
- 5 workers @ 1440 req/day each: Free tier covers this
- Upgrade to paid if needed: $5/month per worker

### Oracle Operations (Per Oracle)
- Gas per update: ~$0.01-0.02
- Updates per day: 288 (5-min frequency)
- Monthly cost per oracle: ~$85-170

### Optimization Tips
- Use longer update frequencies (15min = ~$20/month)
- Batch multiple oracle updates together
- Use Base's low gas fees vs other L2s

---

## Troubleshooting

### Workers Not Triggering

```bash
# Check cron status
wrangler deployments list --env validator-1

# Manually trigger
curl -X POST https://feeds-validator-1.<subdomain>.workers.dev/cron
```

### Consensus Failures

- Check that all 5 validators are funded
- Verify validator addresses match in Registry
- Check worker logs for API errors
- Ensure data sources are accessible

### Deployment Failures

- Check deployer wallet has sufficient ETH
- Verify RPC URL is accessible
- Check gas price settings in hardhat config
- Review transaction logs on Basescan

---

## Security Notes

1. **Private Keys**: Store validator private keys in Cloudflare Secrets, never in code
2. **Rate Limiting**: Implement rate limits on deployment API
3. **Access Control**: Only registry owner can add/remove validators
4. **Oracle Creators**: Only creators can deactivate their oracles
5. **Consensus**: Minimum 51% threshold enforced on-chain

---

## Monitoring & Maintenance

### Key Metrics to Track

- Oracle update frequency
- Consensus success rate
- Validator uptime
- Gas costs per update
- API response times

### Recommended Tools

- Cloudflare Analytics for worker metrics
- Basescan for on-chain activity
- Sentry for error tracking
- Grafana for custom dashboards

---

## Support

For issues or questions:
- Check logs: `wrangler tail --env validator-X`
- Review Basescan transactions
- Verify contract state on Basescan
- Check Cloudflare Worker analytics
