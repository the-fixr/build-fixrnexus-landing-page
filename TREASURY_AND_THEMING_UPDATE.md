# Treasury and Theming Update

## Summary
Fixed theming issues on subscription and analytics pages, removed mock data, and configured treasury address for payment routing.

## Changes Made

### 1. Fixed wagmi Version Compatibility
**Issue:** RainbowKit 2.2.10 requires wagmi ^2.9.0, but wagmi 3.3.4 was installed causing MetaMask extension not to open.

**Fix:** Downgraded wagmi from 3.3.4 to 2.19.5 (latest 2.x version)

**Files Changed:**
- `package.json` - Updated wagmi to ^2.19.5
- `tsconfig.json` - Excluded `contracts` and `workers` folders from TypeScript compilation
- `app/api/oracles/deploy/route.ts` - Fixed ethers.randomBytes() compatibility with v6
- `components/SubscriptionManager.tsx` - Fixed nullish coalescing operator precedence

### 2. Treasury Address Configuration
**Treasury Wallet:** `0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4`

All subscription payments (USDC, ETH, $FEEDS) will be routed to this address.

**Files Changed:**
- `app/subscription/page.tsx` - Added TREASURY_ADDRESS constant

### 3. Subscription Page Theme Fix
**Before:** White background, black text
**After:** Black background with grid pattern, white text matching dashboard theme

**Changes:**
- Removed mock data generation
- Fetch real subscription data from Supabase `subscriptions` table
- Default to free tier (0 calls used, 10,000 limit) if no subscription exists
- Added wallet connection check before upgrade
- Display treasury address in upgrade flow

**File:** `app/subscription/page.tsx`

### 4. Analytics Page Theme Fix and Simplification
**Before:** White background with complex mock charts and data
**After:** Black themed, real data from database, empty state for future features

**Changes:**
- Removed all mock data generation
- Fetch real usage data from Supabase `subscriptions` table
- Show current usage, tier, and monthly limit
- Display usage progress bar with color-coded warnings
- Empty state for detailed analytics (daily trends, cost breakdowns)
- CTA button to create first oracle

**File:** `app/analytics/page.tsx`

## Database Integration

Both pages now query the `subscriptions` table:

```sql
SELECT *
FROM subscriptions
WHERE user_id = {current_user_id}
```

**Expected columns:**
- `tier` - Subscription tier ('free' | 'starter' | 'pro' | 'enterprise')
- `used_calls` - Number of API calls used this month
- `monthly_limit` - Maximum calls allowed per month

**Defaults (if no subscription exists):**
- Tier: `free`
- Used calls: `0`
- Monthly limit: `10000`

## Smart Contract Integration (TODO)

When user clicks upgrade, the flow will be:

1. Check wallet connection (`useAccount` hook)
2. Display treasury address: `0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4`
3. Call appropriate smart contract method:
   - `subscribeWithUSDC(tier)` - for USDC payments
   - `subscribeWithETH(tier)` - for ETH payments
   - `subscribeWithFEEDS(tier)` - for $FEEDS payments (25% discount)
4. Wait for transaction confirmation
5. Update `subscriptions` table in Supabase
6. Refresh page to show new tier

## Testing Notes

- Your account will show as **free tier** with **0/10,000 calls used**
- To test upgrades, you'll need to:
  1. Connect your wallet using RainbowKit
  2. Click upgrade on any tier
  3. Select payment method (USDC/ETH/$FEEDS)
  4. Approve transaction to treasury address
  5. After confirmation, subscription will update in database

## File Summary

### Modified Files:
- `app/subscription/page.tsx` - Black theme, real data, treasury address
- `app/analytics/page.tsx` - Black theme, real data, simplified UI
- `components/SubscriptionManager.tsx` - TypeScript fixes for null safety
- `package.json` - Downgraded wagmi to 2.19.5
- `tsconfig.json` - Excluded contracts and workers folders
- `app/api/oracles/deploy/route.ts` - Fixed ethers v6 compatibility
- `RAINBOWKIT_INTEGRATION.md` - Updated wagmi version

### Created Files:
- `app/analytics/page.tsx.backup` - Backup of old analytics page with mock data

## Next Steps

1. Deploy SubscriptionManager smart contract to Base
2. Add contract address and ABI to frontend
3. Implement transaction signing for upgrades
4. Create `subscriptions` table in Supabase if it doesn't exist
5. Add webhook/cron to track actual oracle API calls
6. Implement daily usage tracking for analytics charts
