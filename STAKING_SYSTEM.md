# FIXR Staking & Fee Distribution System

## Token Utility (Future)

Beyond fee redistribution, implement **Access Tiers** based on staked amount:

| Tier | Staked Amount | Benefits |
|------|---------------|----------|
| Free | 0 | Basic API access, standard rate limits |
| Builder | 1M+ | 2x API rate limits, basic analytics |
| Pro | 10M+ | 5x API rate limits, premium analytics dashboard |
| Elite | 50M+ | Unlimited API, early feature access, priority support |

**Implementation ideas:**
- API rate limits tied to staked amount (check on-chain balance)
- Premium analytics dashboards (token-gated pages)
- Early access to new features (beta flags based on stake)
- Could also gate access to advanced Builder ID features

---

## Overview

A staking system where FIXR token holders stake to earn a share of Clanker trading fees. The fee recipient contract splits incoming fees 70/30 between stakers and treasury.

## Architecture

```
Clanker Token Launch → FIXR Token (fee recipient: FixrFeeSplitter)
                                          ↓
                              ┌───────────┴───────────┐
                              ↓                       ↓
                        70% Stakers              30% Treasury
                              ↓                 (0xBe2Cc...3fa4)
                        FixrStaking
                              ↓
                   Users stake FIXR → Earn fees
```

## Deployed Contracts (Base Mainnet)

| Contract | Address | BaseScan |
|----------|---------|----------|
| DummyToken (dFIXR) | `0x8cBb89d67fDA00E26aEd0Fc02718821049b41610` | [View](https://basescan.org/address/0x8cBb89d67fDA00E26aEd0Fc02718821049b41610#code) |
| FixrStaking | `0x39DbBa2CdAF7F668816957B023cbee1841373F5b` | [View](https://basescan.org/address/0x39DbBa2CdAF7F668816957B023cbee1841373F5b#code) |
| FixrFeeSplitter | `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` | [View](https://basescan.org/address/0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928#code) |

## Configuration

- **Treasury:** `0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4`
- **WETH (Base):** `0x4200000000000000000000000000000000000006`
- **Split:** 70% Stakers / 30% Treasury
- **Timelock:** 48 hours for critical config changes

## Lock Tiers

| Tier | Lock Period | Multiplier | Use Case |
|------|-------------|------------|----------|
| 0 | 7 days | 1.0x | Short-term stakers |
| 1 | 30 days | 1.25x | Medium commitment |
| 2 | 90 days | 1.5x | Long-term believers |
| 3 | 180 days | 2.0x | Maximum rewards |

## Security Features

### FixrStaking
- **Ownable2Step:** Two-step ownership transfer prevents accidental transfers
- **ReentrancyGuard:** Prevents reentrancy attacks on all state-changing functions
- **Pausable:** Emergency pause capability for all staking operations
- **SafeERC20:** Safe token transfers that handle non-standard ERC20s
- **Immutable token address:** Cannot be changed after deployment
- **Max 10 reward tokens:** Prevents gas exhaustion in loops
- **Fee-on-transfer support:** Verifies actual received amounts

### FixrFeeSplitter
- **48-hour timelock:** On staking contract and treasury address changes
- **Minimum distribution threshold:** 0.001 tokens prevents dust attacks
- **WETH cannot be removed:** From whitelist (always a valid reward token)
- **Auto-wraps ETH:** Incoming ETH automatically converted to WETH

## Launching Real FIXR Token

When ready to launch the real FIXR token via Clanker:

### 1. Launch Token
```
Set fee recipient to: 0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928
```

### 2. Deploy New Staking Contract
```bash
cd feeds.review/contracts
FIXR_TOKEN_ADDRESS=<real_fixr_address> npx hardhat run scripts/deploy-staking.cjs --network base
```

Note: Only deploys FixrStaking, reuses existing FixrFeeSplitter.

### 3. Update FeeSplitter (48hr Timelock)

Queue the change:
```solidity
feeSplitter.queueStakingContractChange(newStakingAddress)
```

Wait 48 hours, then execute:
```solidity
feeSplitter.setStakingContract(newStakingAddress)
```

## Monthly Fee Distribution

As the owner, call monthly to distribute accumulated fees:

```solidity
feeSplitter.distributeAll()
```

This will:
1. Take all WETH in the FeeSplitter
2. Send 70% to FixrStaking (distributed to stakers by weight)
3. Send 30% to Treasury

## User Flow

### Staking
```solidity
// 1. Approve
fixrToken.approve(stakingAddress, amount);

// 2. Stake with chosen tier (0-3)
staking.stake(amount, tierIndex);
```

### Claiming Rewards
```solidity
// Claim all pending rewards
staking.claimRewards();

// Or claim specific token
staking.claimRewardToken(wethAddress);
```

### Unstaking (after lock expires)
```solidity
staking.unstake(positionId);
```

## Contract Source Files

```
feeds.review/contracts/contracts/
├── FixrStaking.sol
├── FixrFeeSplitter.sol
├── DummyToken.sol
└── interfaces/
    ├── IFixrStaking.sol
    └── IFixrFeeSplitter.sol
```

## Scripts

```
feeds.review/contracts/scripts/
├── deploy-staking.cjs      # Deploy staking system
├── verify-staking.cjs      # Verify on BaseScan
├── test-staking.cjs        # Full test suite
├── check-balances.cjs      # Check contract balances
├── distribute-fees.cjs     # Distribute fees
└── claim-rewards.cjs       # Claim rewards
```

## Environment Variables

```env
DEPLOYER_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=...

# Optional
DUMMY_TOKEN_ADDRESS=0x...  # Skip dummy token deployment
FIXR_TOKEN_ADDRESS=0x...   # Use real FIXR token
USE_DUMMY_TOKEN=true       # Deploy with dummy token
```

## Tested & Verified

All contracts deployed to Base mainnet and verified on BaseScan. Full test completed:
- ✅ Staking with lock tiers
- ✅ ETH → WETH auto-wrapping
- ✅ 70/30 fee distribution
- ✅ Reward claiming

---

## Token Launch Strategy (Clanker)

### Vault Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Vault %** | 80% | Deeper LP for volume, still get 80B for future rewards |
| **Vault Duration** | 6 months | Squeeze period rewards early stakers, full liquidity by month 12 |
| **LP Tokens** | 20B | Healthy trading depth, enables volume for CoinGecko listing |
| **Personal Stake** | Dev buy at market | No insider allocation, skin in game at fair price |

### Token Distribution

```
100B Total Supply
├── 80B → Vault (locked 6 months)
│         └── Unlocks for community/builder rewards
└── 20B → Liquidity Pool
          └── Available for trading immediately
```

### The Squeeze Strategy (Months 1-6)

**Scarcity creates value:**
- Only 20B circulating (20% of supply)
- Staking locks up tokens → reduces sell pressure
- Elite tier (50M+) = real API utility → demand for large stakes
- High APY during low-supply period → shareable screenshots

**Flywheel:**
1. 20B LP = healthy volume capacity
2. Volume = trading fees to FixrFeeSplitter
3. Fees = high APY for early stakers
4. "100% APY" tweets = free marketing
5. Attention = more volume
6. CoinGecko listing = legitimacy + discovery
7. Repeat

### Launch Checklist

- [ ] Deploy FIXR via Clanker
  - Fee recipient: `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` (FixrFeeSplitter)
  - Vault: 80%
  - Duration: 6 months
- [ ] Deploy new FixrStaking with real FIXR token address
- [ ] Queue staking contract change on FeeSplitter (48hr timelock)
- [ ] Execute staking contract change after timelock
- [ ] Dev buy at launch for personal stake
- [ ] First fee distribution after volume builds
- [ ] Submit to CoinGecko once volume/liquidity thresholds met

### Post-Launch (Month 6)

When vault unlocks:
- 80B tokens available for community/builder incentives
- Ecosystem should be proven by then
- Options: staking rewards, airdrops, partnerships, grants
- Can distribute gradually to avoid dilution shock

### Key Addresses

| Purpose | Address |
|---------|---------|
| FixrFeeSplitter (fee recipient) | `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` |
| Treasury | `0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4` |
| FIXR Token | TBD (Clanker launch) |

---

## API Access System

Stakers get tiered API access based on their staked FIXR balance. Non-stakers can pay per request via x402.

### Tier-Based Rate Limits

| Tier | Staked Amount | Rate Limit | Benefits |
|------|---------------|------------|----------|
| FREE | 0 | 10/min | Basic access |
| BUILDER | 1M+ | 20/min (2x) | Basic analytics, email support |
| PRO | 10M+ | 50/min (5x) | Premium dashboard, priority support |
| ELITE | 50M+ | Unlimited | Early access, dedicated support |

### Authentication Methods

**1. Wallet Header (Simple)**
```
X-Wallet-Address: 0xYourWalletAddress
```

**2. Bearer Token with Signature (Secure)**
```
Authorization: Bearer 0xWallet:0xSignature
X-Signed-Message: <the message that was signed>
```

**3. x402 Payment (Pay-per-request)**
```
X-Payment-TxHash: 0xTransactionHash
```

### x402 Pay-Per-Call (USDC)

**Price:** $0.01 USDC per API call

- **Token:** USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Recipient:** Treasury (`0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4`)
- **Each tx can only be used once** (prevents replay attacks)

**x402 Flow:**
1. Client makes request to protected endpoint
2. Server returns 402 with payment details
3. Client sends $0.01 USDC to treasury
4. Client retries request with `X-Payment-TxHash: 0x...`
5. Server verifies payment, serves content

### API Endpoints

**Check Tier**
```
GET /api/access/tier?wallet=0x...
```
Returns: tier, staked amount, rate limit, benefits, auth challenge

**Get Payment Info**
```
GET /api/access/payment?wallet=0x...
```
Returns: pricing, payment URIs, current credits

**Submit Payment**
```
POST /api/access/payment
{ "txHash": "0x...", "wallet": "0x..." }
```
Returns: credits added

**Protected Endpoint Example**
```
GET /api/access/protected
Headers: X-Wallet-Address: 0x...
```

### Response Headers

All API responses include:
- `X-Access-Tier`: Your current tier
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-Wallet-Verified`: Whether wallet was verified

### 402 Payment Required Response

When access is denied and payment is an option:

```json
{
  "error": "payment_required",
  "message": "Payment required to access /api/endpoint",
  "payment": {
    "recipient": "0xBe2Cc...",
    "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "0.01",
    "currency": "USDC",
    "decimals": 6,
    "network": "base",
    "chainId": 8453
  },
  "alternatives": {
    "staking": {
      "description": "Stake FIXR tokens for unlimited API access",
      "minAmount": "1,000,000 FIXR (Builder tier)"
    }
  }
}
```

### Usage in API Routes

```typescript
import { checkApiAccess, createAccessHeaders } from '@/lib/api-access';

export async function GET(request: NextRequest) {
  const access = await checkApiAccess(request, {
    minimumTier: 'BUILDER',  // Require BUILDER or higher
    allowPayment: true,       // Allow x402 fallback
  });

  if (!access.allowed) {
    return access.response;
  }

  // Proceed with protected logic...
  return NextResponse.json(data, {
    headers: createAccessHeaders(access),
  });
}
```

### Files

```
src/lib/
├── staking-tiers.ts    # Tier checking, on-chain queries
├── x402-payments.ts    # Payment verification, credits
└── api-access.ts       # Middleware combining both

src/app/api/access/
├── tier/route.ts       # Check wallet tier
├── payment/route.ts    # Payment info and verification
└── protected/route.ts  # Example protected endpoint
```
