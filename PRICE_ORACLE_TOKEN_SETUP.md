# Price Oracle with GeckoTerminal Token Address

## Overview

Price oracles now automatically fetch price data from GeckoTerminal using the token's contract address. No manual validator configuration needed!

## What Changed

### 1. Oracle Creation Flow ([app/create-oracle/page.tsx](app/create-oracle/page.tsx))

**Step 1 - Oracle Type:** Select "TOKEN PRICE FEED"

**Step 2 - Data Source & Token Address:**
- Select data source (GeckoTerminal recommended)
- **NEW:** Enter the token contract address on Base
  - Example: `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` (DEGEN)
- This address is stored in the `target_token` column

**Fixed:** Added `OracleDeployed` event to factory ABI so contract addresses are saved correctly

### 2. Oracle Metadata API ([app/api/v1/oracle-metadata/[address]/route.ts](app/api/v1/oracle-metadata/[address]/route.ts))

New endpoint for validators to fetch oracle configuration:

```
GET /api/v1/oracle-metadata/0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723
```

Returns:
```json
{
  "success": true,
  "oracle": {
    "address": "0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723",
    "name": "DEGEN-PRICE",
    "type": "price",
    "targetToken": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    "updateFrequency": 300,
    "consensusThreshold": 66,
    "dataSource": "geckoterminal"
  }
}
```

### 3. Validator Updates ([workers/validator-template.ts](workers/validator-template.ts))

**Added:**
- `fetchOracleMetadata()` - Queries Next.js API for oracle config
- Updated `validatePriceOracle()` - Uses token address from metadata
- Updated `fetchPriceData()` - Queries GeckoTerminal with token address

**How it works:**
1. Validator gets oracle list from on-chain registry
2. For each oracle, calls `/api/v1/oracle-metadata/[address]` to get token address
3. Uses token address to query GeckoTerminal:
   ```
   GET https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/{tokenAddress}
   ```
4. Submits price to oracle contract

## How to Use

### Creating a Price Oracle

1. Go to `/create-oracle`
2. **Step 1:** Select "TOKEN PRICE FEED"
3. **Step 2:**
   - Select GeckoTerminal as data source
   - Enter the token's Base contract address (e.g., `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` for DEGEN)
4. **Step 3-5:** Configure update frequency, consensus, and deploy

That's it! The validators will automatically:
- Fetch the token address from the database
- Query GeckoTerminal for the price
- Submit to the oracle contract every N minutes

### Finding Token Addresses

**On Base:**
- Go to https://basescan.org/
- Search for the token name
- Copy the contract address

**On GeckoTerminal:**
- Go to https://geckoterminal.com/
- Search for the token
- Click on the token
- Copy the contract address from the URL or token info

**Examples:**
- DEGEN: `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed`
- VIRTUAL: `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`
- HIGHER: `0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe`

### Setting Up Validators

Validators need one additional environment variable:

```bash
# In Cloudflare Worker settings:
API_BASE_URL=https://your-app.com  # or http://localhost:3000 for local testing
```

This allows validators to fetch oracle metadata (including token address).

**Other required env vars:**
- `VALIDATOR_PRIVATE_KEY` - Validator wallet private key
- `RPC_URL` - Base RPC endpoint
- `ORACLE_REGISTRY_ADDRESS` - Registry contract address

## Your Fixed Price Oracle

The oracle you just deployed has been fixed:

**Oracle Details:**
- Contract: `0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723`
- TX: `0xf3156765befbe48f3c3ff677a2aa899740e1dae1516db3d4686aca4fa43f3dd1`
- View on BaseScan: https://basescan.org/address/0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723

**To Complete Setup:**
1. Update the oracle name in the database (currently empty)
2. Add the token contract address you want to track
3. Deploy validators with `API_BASE_URL` env var

## Database Schema

The `oracles` table stores the token address:

```sql
-- For price oracles: token contract address on Base
-- For farcaster oracles: token symbol (e.g., "DEGEN")
target_token TEXT
```

## API Endpoints

### Query Price Oracle
```
GET /api/v1/oracle/0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723
```

Returns current price, submissions, and oracle config.

### Get Oracle Metadata (for validators)
```
GET /api/v1/oracle-metadata/0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723
```

Returns oracle configuration including token address.

## GeckoTerminal API

Validators query:
```
GET https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/{tokenAddress}
```

**Response:**
```json
{
  "data": {
    "id": "base",
    "type": "simple_token_price",
    "attributes": {
      "token_prices": {
        "0x4ed4e862860bed51a9570b96d89af5e1b0efefed": "0.0123456"
      }
    }
  }
}
```

**No API key required** - GeckoTerminal's public API is free with rate limiting.

## Troubleshooting

### Price Not Updating

1. **Check validators are running:**
   ```bash
   curl https://your-validator.workers.dev/health
   ```

2. **Check validator can fetch metadata:**
   ```bash
   curl http://localhost:3000/api/v1/oracle-metadata/0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723
   ```

3. **Check GeckoTerminal has the token:**
   ```bash
   curl https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed
   ```

4. **Verify token address in database:**
   ```sql
   SELECT target_token FROM oracles WHERE contract_address = '0xf8A2B3b8dDDC9050D980bd8c1C9c59Bf9bCB7723';
   ```

### Token Not Found on GeckoTerminal

If GeckoTerminal doesn't have data for a token:
- Make sure it's deployed on Base (Chain ID 8453)
- Check if there's liquidity on Base DEXes
- Try alternative data sources (DexScreener, Uniswap Subgraph)

### Event Parsing Error (FIXED)

The "No OracleDeployed event found" error has been fixed by adding the event to the factory ABI. Future deployments will save contract addresses correctly.

## Summary

1. ✅ **Fixed:** Event parsing error - added `OracleDeployed` to factory ABI
2. ✅ **Fixed:** Your price oracle - contract address recovered and saved
3. ✅ **Added:** Token address input in oracle creation (Step 2)
4. ✅ **Added:** Oracle metadata API endpoint for validators
5. ✅ **Updated:** Validators to fetch token address from API
6. ✅ **Updated:** GeckoTerminal integration to use dynamic token address

Now you can deploy unlimited price oracles for any token on Base - just enter the token's contract address during creation!
