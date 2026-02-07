# Validator Trigger Endpoint Specification

This document specifies the `/trigger` endpoint that each validator must implement to support immediate oracle updates.

## Endpoint

```
POST https://feeds-validator-X.see21289.workers.dev/trigger
```

## Request Body

```json
{
  "oracleAddress": "0x81713011c8d4940baCbdec0081f77c25fc13EFeA"
}
```

## Expected Behavior

When this endpoint is called, the validator should:

1. **Validate the oracle address** - Ensure it's a valid Ethereum address
2. **Check if oracle exists** - Query the OracleRegistry to verify the oracle is registered
3. **Fetch the oracle's configuration** - Get oracle type, target token, update frequency, etc.
4. **Fetch fresh data** based on oracle type:
   - **Price Oracle**: Fetch latest price from GeckoTerminal or configured data source
   - **Farcaster Oracle**: Fetch latest metrics for target token
   - **Custom Oracle**: Call configured API endpoint
5. **Submit price to contract** - Call `submitPrice(uint256 price)` on the oracle contract
6. **Return success response**

## Response Format

### Success (200 OK)

```json
{
  "success": true,
  "oracleAddress": "0x81713011c8d4940baCbdec0081f77c25fc13EFeA",
  "validator": "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
  "priceSubmitted": "125000000",
  "formattedPrice": "1.25",
  "dataSource": "geckoterminal",
  "timestamp": "2026-01-22T12:00:00Z",
  "txHash": "0xabc123..."
}
```

### Oracle Not Found (404)

```json
{
  "success": false,
  "error": "Oracle not found in registry",
  "oracleAddress": "0x81713011c8d4940baCbdec0081f77c25fc13EFeA"
}
```

### Data Fetch Failed (500)

```json
{
  "success": false,
  "error": "Failed to fetch price data",
  "oracleAddress": "0x81713011c8d4940baCbdec0081f77c25fc13EFeA",
  "details": "GeckoTerminal API returned 404"
}
```

### Submission Failed (500)

```json
{
  "success": false,
  "error": "Failed to submit price to contract",
  "oracleAddress": "0x81713011c8d4940baCbdec0081f77c25fc13EFeA",
  "details": "Transaction reverted: Update too soon"
}
```

## Implementation Example (Cloudflare Worker)

```typescript
// POST /trigger
export async function handleTrigger(request: Request, env: Env): Promise<Response> {
  try {
    const { oracleAddress } = await request.json();

    if (!oracleAddress || !ethers.isAddress(oracleAddress)) {
      return Response.json({
        success: false,
        error: 'Invalid oracle address'
      }, { status: 400 });
    }

    // 1. Get oracle config from registry
    const registry = new ethers.Contract(
      env.ORACLE_REGISTRY_ADDRESS,
      REGISTRY_ABI,
      provider
    );

    const isRegistered = await registry.isOracleRegistered(oracleAddress);
    if (!isRegistered) {
      return Response.json({
        success: false,
        error: 'Oracle not found in registry',
        oracleAddress
      }, { status: 404 });
    }

    // 2. Get oracle details
    const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
    const [name, symbol] = await Promise.all([
      oracle.name(),
      oracle.symbol()
    ]);

    // 3. Fetch price data based on oracle type
    const price = await fetchPriceData(oracleAddress, env);

    // 4. Submit to contract
    const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);
    const oracleWithSigner = oracle.connect(wallet);

    const tx = await oracleWithSigner.submitPrice(price);
    await tx.wait();

    return Response.json({
      success: true,
      oracleAddress,
      validator: wallet.address,
      priceSubmitted: price.toString(),
      formattedPrice: ethers.formatUnits(price, 8),
      timestamp: new Date().toISOString(),
      txHash: tx.hash
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to trigger update',
      oracleAddress: request.oracleAddress
    }, { status: 500 });
  }
}
```

## Notes

- **Idempotency**: The endpoint should be idempotent - calling it multiple times should be safe
- **Rate Limiting**: Validators may implement their own rate limiting
- **Gas Management**: Validators should check gas prices and oracle update frequency before submitting
- **Error Handling**: Should gracefully handle reverts (e.g., "Update too soon" if called before update frequency has elapsed)
- **Timeout**: The trigger call should timeout after 10 seconds
- **Logging**: All trigger calls should be logged for debugging

## Current Status

As of now, the `/trigger` endpoint needs to be implemented in all 5 validator workers:
- ✅ feeds-validator-1.see21289.workers.dev
- ✅ feeds-validator-2.see21289.workers.dev
- ✅ feeds-validator-3.see21289.workers.dev
- ✅ feeds-validator-4.see21289.workers.dev
- ✅ feeds-validator-5.see21289.workers.dev

Once implemented, the trigger system will enable immediate oracle updates when new oracles are deployed.
