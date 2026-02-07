# Farcaster Oracle - Quick Start Guide

## Deploy Validators (Required)

```bash
# 1. Navigate to workers directory
cd /Users/chadneal/Desktop/feeds.review/workers

# 2. Deploy all validators
./deploy-validators.sh

# 3. Set Neynar API key
./update-validators.sh

# 4. Verify validators are online
curl http://localhost:3000/api/v1/validators
```

## Run Database Migration (Required)

1. Go to: https://supabase.com/dashboard/project/ozzlbctzerobxcwlqtzr/sql
2. Run:
```sql
ALTER TABLE oracles ADD COLUMN IF NOT EXISTS target_token TEXT;
```

## Test the System

```bash
# 1. Start the app
npm run dev

# 2. Visit API Studio
open http://localhost:3000/api-studio

# 3. Create Farcaster oracle
open http://localhost:3000/create-oracle
# Select: FARCASTER SOCIAL DATA
# Token: DEGEN
# Deploy with your wallet
```

## Monitor Results

```bash
# Check validators
curl http://localhost:3000/api/v1/validators

# Check oracle (replace with your address)
curl http://localhost:3000/api/v1/farcaster/0x...
```

## Deployed Contracts

- **OracleRegistry**: `0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64`
- **OracleFactory**: `0xBe17f562BF4068fb429D7729D0EAa64cEBf3ed88`
- **Network**: Base Mainnet (Chain ID: 8453)

## Your Neynar API Key

```
C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C
```

## Documentation

- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Complete overview
- [VALIDATOR_DEPLOYMENT.md](VALIDATOR_DEPLOYMENT.md) - Detailed deployment guide
- [FARCASTER_ORACLE.md](FARCASTER_ORACLE.md) - Technical documentation

That's it! 🚀
