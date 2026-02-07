# FIXR API Access Guide

> Access FIXR's API through staking or pay-per-call

## Overview

FIXR provides tiered API access based on FIXR token staking. Non-stakers can use x402 micropayments for pay-per-call access.

## Access Tiers

| Tier | Staked FIXR | Rate Limit | Benefits |
|------|-------------|------------|----------|
| FREE | 0 | 10/min | Basic access |
| BUILDER | 1M+ | 20/min | 2x limits, basic analytics |
| PRO | 10M+ | 50/min | 5x limits, premium dashboard |
| ELITE | 50M+ | Unlimited | All features, priority support |

## Authentication Methods

### 1. Wallet Header (Simple)

Add your wallet address to requests:

```bash
curl -H "X-Wallet-Address: 0xYourWalletAddress" \
  https://fixr-agent.see21289.workers.dev/api/token/analyze
```

Your tier is determined by on-chain staked balance in the FixrStaking contract.

### 2. Signed Authentication (Secure)

For higher security, sign a challenge:

```bash
# 1. Get challenge
curl "https://fixr-agent.see21289.workers.dev/api/access/tier?wallet=0xYourWallet"

# Response includes authChallenge

# 2. Sign the challenge with your wallet

# 3. Send signed request
curl -H "Authorization: Bearer 0xWallet:0xSignature" \
     -H "X-Signed-Message: <the signed message>" \
     https://fixr-agent.see21289.workers.dev/api/token/analyze
```

### 3. x402 Pay-Per-Call

Pay $0.01 USDC per API call. No staking required.

## x402 Payment Flow

```
┌─────────┐         ┌──────────┐         ┌────────────┐
│ Client  │         │  Server  │         │    Base    │
└────┬────┘         └────┬─────┘         └─────┬──────┘
     │                   │                     │
     │ 1. Request API    │                     │
     │──────────────────>│                     │
     │                   │                     │
     │ 2. 402 Payment    │                     │
     │<──────────────────│                     │
     │    Required       │                     │
     │                   │                     │
     │ 3. Send $0.01 USDC to treasury         │
     │────────────────────────────────────────>│
     │                   │                     │
     │ 4. Retry with     │                     │
     │    X-Payment-TxHash                     │
     │──────────────────>│                     │
     │                   │ 5. Verify tx        │
     │                   │────────────────────>│
     │                   │                     │
     │ 6. Response       │                     │
     │<──────────────────│                     │
     │                   │                     │
```

### Step-by-Step

**1. Make a request (will receive 402 if rate limited)**

```bash
curl -i https://fixr-agent.see21289.workers.dev/api/token/analyze \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

**2. If rate limited, receive 402 with payment details:**

```json
{
  "error": "payment_required",
  "message": "Payment of $0.01 USDC required",
  "payment": {
    "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "recipient": "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
    "amount": "0.01",
    "amountRaw": "10000",
    "currency": "USDC",
    "decimals": 6,
    "network": "base",
    "chainId": 8453
  }
}
```

**3. Send USDC payment on Base:**

```javascript
// Using ethers.js
const usdc = new ethers.Contract(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ["function transfer(address to, uint256 amount) returns (bool)"],
  signer
);

const tx = await usdc.transfer(
  "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
  10000n // $0.01 (6 decimals)
);
await tx.wait();
```

**4. Retry request with transaction hash:**

```bash
curl https://fixr-agent.see21289.workers.dev/api/token/analyze \
  -H "Content-Type: application/json" \
  -H "X-Payment-TxHash: 0xYourTransactionHash" \
  -d '{"address": "0x..."}'
```

**Important:** Each transaction hash can only be used once. This prevents replay attacks.

## API Endpoints

### Check Your Tier

```bash
GET /api/access/tier?wallet=0x...
```

Response:
```json
{
  "success": true,
  "wallet": "0x...",
  "tier": "BUILDER",
  "stakedAmount": "1500000000000000000000000",
  "stakedFormatted": "1.5M",
  "rateLimit": "20/min",
  "benefits": ["2x rate limits", "Basic analytics"],
  "nextTier": { "tier": "PRO", "required": "10M FIXR" }
}
```

### Get Payment Info

```bash
GET /api/access/payment
```

Response:
```json
{
  "success": true,
  "x402": {
    "pricePerCall": "$0.01",
    "token": {
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "symbol": "USDC",
      "decimals": 6
    },
    "recipient": "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
    "paymentUri": "ethereum:0x833589...@8453/transfer?address=0xBe2Cc...&uint256=10000"
  }
}
```

### Verify Payment (Testing)

```bash
POST /api/access/payment
Content-Type: application/json

{ "txHash": "0x..." }
```

## Response Headers

All API responses include:

| Header | Description |
|--------|-------------|
| `X-Access-Tier` | Your current tier (FREE/BUILDER/PRO/ELITE) |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-Wallet-Verified` | Whether wallet address was verified |
| `X-Payment-Verified` | Whether x402 payment was verified |

## SDK Example (JavaScript)

```javascript
class FixrClient {
  constructor(walletAddress, signer) {
    this.wallet = walletAddress;
    this.signer = signer;
    this.baseUrl = 'https://fixr-agent.see21289.workers.dev';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Wallet-Address': this.wallet,
      ...options.headers
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    // Handle x402 payment required
    if (response.status === 402) {
      const data = await response.json();
      const txHash = await this.pay(data.payment);

      // Retry with payment proof
      return fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          'X-Payment-TxHash': txHash
        }
      });
    }

    return response;
  }

  async pay(payment) {
    const usdc = new ethers.Contract(
      payment.tokenAddress,
      ['function transfer(address,uint256) returns (bool)'],
      this.signer
    );

    const tx = await usdc.transfer(
      payment.recipient,
      BigInt(payment.amountRaw)
    );
    await tx.wait();
    return tx.hash;
  }

  async analyzeToken(address) {
    const res = await this.request('/api/token/analyze', {
      method: 'POST',
      body: JSON.stringify({ address })
    });
    return res.json();
  }
}

// Usage
const client = new FixrClient(walletAddress, signer);
const analysis = await client.analyzeToken('0xTokenAddress');
```

## Staking for Access

To get tier benefits, stake FIXR tokens:

**Staking Contract:** `0x39DbBa2CdAF7F668816957B023cbee1841373F5b`

```javascript
import { ethers } from 'ethers';

const stakingAbi = [
  'function stake(uint256 amount, uint8 tier) external',
  'function unstake(uint256 positionId) external',
  'function claimRewards() external',
  'function getUserStake(address) view returns (uint256)'
];

const staking = new ethers.Contract(
  '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
  stakingAbi,
  signer
);

// Approve FIXR tokens first
await fixrToken.approve(staking.address, amount);

// Stake with lock tier (0-3)
// 0: 7 days (1x), 1: 30 days (1.25x), 2: 90 days (1.5x), 3: 180 days (2x)
await staking.stake(amount, 1); // 30-day lock
```

## Cost Comparison

| Method | Cost per 1000 calls |
|--------|---------------------|
| x402 Pay-per-call | $10.00 |
| BUILDER tier (1M FIXR staked) | Free (within limits) |
| PRO tier (10M FIXR staked) | Free (within limits) |
| ELITE tier (50M FIXR staked) | Free (unlimited) |

## Troubleshooting

### "Transaction already used"
Each tx hash works once. Send a new USDC payment for each API call.

### "No USDC payment to treasury found"
Ensure you sent USDC (not ETH) to the correct treasury address on Base mainnet.

### "Insufficient payment"
Send at least $0.01 USDC (10000 raw units with 6 decimals).

### "Rate limit exceeded" (even with staking)
Your tier rate limit is per-minute. Wait for the reset or use x402 to bypass.

## Contract Addresses

| Contract | Address |
|----------|---------|
| FixrStaking | `0x39DbBa2CdAF7F668816957B023cbee1841373F5b` |
| FixrFeeSplitter | `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` |
| Treasury | `0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |
| FIXR Token | TBD (Clanker launch) |

---

Questions? Reach out via [XMTP](xmtp://fixr.base.eth) or [@fixr on Farcaster](https://farcaster.xyz/fixr).
