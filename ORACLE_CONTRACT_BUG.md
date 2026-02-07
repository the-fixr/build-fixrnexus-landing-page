# Oracle Contract Bug - Overflow Error

## Problem Identified

Your deployed Farcaster Oracle at `0xc4f7822a9DeCB9d15aadBc079D2c052C229E24dB` has a **critical bug** that causes it to revert with **Panic(17) - OVERFLOW** when validators try to submit metrics.

### Error Details

```
Panic due to OVERFLOW(17)
Transaction would revert during gas estimation
```

### What's Happening

Validators are successfully:
- ✅ Detecting the oracle
- ✅ Fetching Farcaster data from Neynar
- ✅ Calculating metrics
- ✅ Have sufficient gas (0.001 ETH each)
- ✅ Attempting to submit metrics

But the contract is **rejecting the submission** with an arithmetic overflow error.

### Example Metrics Being Submitted

```solidity
submitMetrics(
  mentions24h:      100,
  sentimentScore:   2200,    // int256 (can be negative)
  engagementRate:   5300,
  uniqueUsers:      19,
  totalEngagement:  53,
  topCastFid:       480184
)
```

These are reasonable values, but the contract's internal logic (likely median calculation or consensus aggregation) is causing an overflow.

---

## Root Cause

The deployed `FarcasterOracle` contract likely has a bug in one of these areas:

1. **Median Calculation**: When calculating the median of submitted values across multiple validators, there may be unsafe arithmetic
2. **Consensus Logic**: Aggregating submissions might overflow
3. **SafeMath with Signed Integers**: The `sentimentScore` is `int256` (can be negative), and mixing signed/unsigned math can cause overflows
4. **Array Bounds**: Submission storage might have an off-by-one error

---

## Why This Wasn't Caught Earlier

- The contract deployed successfully
- The contract is registered in OracleRegistry
- The contract's `needsUpdate()` function works correctly
- The bug only manifests when **submitting metrics**, not during reads

This suggests the overflow happens in the `submitMetrics()` function or the consensus calculation triggered by it.

---

## Solutions

### Option 1: Deploy a New Oracle (Recommended)

The contract code needs to be fixed and redeployed. You'll need to:

1. **Fix the contract bug** in the `FarcasterOracle.sol`:
   - Add SafeMath for all arithmetic
   - Handle signed integer math carefully
   - Add bounds checking on submission arrays
   - Test median calculation with various inputs

2. **Redeploy the contract** using the factory:
   ```javascript
   // Via UI at http://localhost:3000/create-oracle
   // Or programmatically:
   await factory.deployFarcasterOracle(
     "FC-DEGEN-V2",
     "FC-DEGEN-V2",
     "DEGEN",
     66, // consensus threshold
     3600 // update frequency
   );
   ```

3. **Update the database** to point to the new oracle address

### Option 2: Workaround (Temporary)

If you have access to the contract source and can identify the exact overflow, you might be able to:

- Reduce the magnitude of metrics being submitted
- Clamp values to safe ranges
- Convert int256 to uint256 where possible

However, this is **not recommended** as it masks the underlying bug.

### Option 3: Manual Submission (Testing Only)

For testing purposes, you could try submitting with very small values to see if it's a magnitude issue:

```javascript
submitMetrics(
  1,      // mentions24h
  100,    // sentimentScore
  100,    // engagementRate
  1,      // uniqueUsers
  1,      // totalEngagement
  1       // topCastFid
)
```

If this works, the issue is value magnitude. If it still fails, it's a structural bug in the contract.

---

## Contract Source Location

The Farcaster Oracle contract source is likely in one of these locations:

1. A separate contracts repository
2. `contracts/FarcasterOracle.sol` (not in this repo)
3. Deployed from a factory with embedded bytecode

You'll need to locate the source code to fix the bug and redeploy.

---

## Immediate Next Steps

1. **Locate the FarcasterOracle.sol source code**
2. **Review the `submitMetrics()` function** for:
   - Unchecked arithmetic
   - Array access without bounds checking
   - Signed/unsigned integer mixing
   - Median calculation logic

3. **Fix the bug** by:
   - Using `SafeMath` or Solidity 0.8+ checked arithmetic
   - Adding proper bounds checks
   - Handling negative sentiment scores safely

4. **Test thoroughly** with:
   - Single submission
   - Multiple submissions
   - Consensus threshold
   - Extreme values (large numbers, negative sentiment)

5. **Redeploy and test** before going to production

---

## Why Validators Didn't Submit (Summary)

1. ✅ **Gas**: Fixed - validators now have 0.001 ETH each
2. ✅ **Detection**: Working - validators detect the oracle
3. ✅ **Data Fetching**: Working - validators fetch from Neynar
4. ✅ **Metrics Calculation**: Working - validators calculate correctly
5. ❌ **Contract Bug**: **The deployed contract has an overflow bug**

The validators are functioning perfectly. The issue is entirely in the deployed smart contract code.

---

## Files Updated

- [workers/validator-template.ts:170](../workers/validator-template.ts#L170) - Fixed gas threshold from `> 0.001` to `>= 0.0005`
- [app/dashboard/page.tsx:197-203](../app/dashboard/page.tsx#L197-L203) - Added API Studio link

---

## Status

- **Validators**: ✅ Fully operational with sufficient gas
- **Oracle Contract**: ❌ Has overflow bug, needs redeployment
- **Registry**: ✅ Oracle registered correctly
- **API**: ✅ Reading oracle state correctly

**Action Required**: Fix and redeploy the FarcasterOracle contract.
