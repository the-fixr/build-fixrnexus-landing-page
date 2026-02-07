# User-Paid Oracle Deployment

## Overview

Oracle deployment has been refactored to use a **user-paid model** where users deploy their own oracles using their connected wallet. This is more decentralized, sustainable, and secure than using a centralized deployer wallet.

## Changes Made

### 1. Client-Side Deployment ([app/create-oracle/page.tsx](app/create-oracle/page.tsx))

**New Imports:**
```typescript
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
```

**New Hooks:**
```typescript
const { address, isConnected } = useAccount();
const { data: walletClient } = useWalletClient();
```

**Updated `handleDeploy` Function:**
- Checks if wallet is connected
- Creates oracle record in database (status: 'deploying')
- Deploys contract using **user's wallet** via ethers.js
- Waits for transaction confirmation
- Parses OracleDeployed event to get contract address
- Updates database with deployment info (status: 'active')
- Redirects to dashboard on success

**UI Changes:**
- Deploy button disabled if wallet not connected
- Warning message if wallet not connected
- Loading state during deployment
- Error display if deployment fails

### 2. Deprecated API Route ([app/api/oracles/deploy/route.ts](app/api/oracles/deploy/route.ts))

The API route is **no longer used** and returns HTTP 410 (Gone). All deployment logic moved to client-side.

### 3. Environment Variables ([.env.local](.env.local))

**Removed:**
- `DEPLOYER_PRIVATE_KEY` - No longer needed
- `BASE_RPC_URL` - Not needed for client-side deployment
- `FACTORY_ADDRESS` - Using `NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS` instead
- `REGISTRY_ADDRESS` - Using `NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS` instead

**Still Required:**
- `NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS` - Factory contract address on Base
- `NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS` - Registry contract address on Base

## How It Works

### User Flow

1. **User creates oracle configuration** in 5-step wizard:
   - Select oracle type (Price, Farcaster, Liquidity, Custom)
   - Choose data sources
   - Set update frequency
   - Configure consensus threshold
   - Review and deploy

2. **User clicks "Deploy Oracle"**:
   - Wallet connection checked
   - Oracle record created in Supabase (status: 'deploying')
   - MetaMask prompts user to sign transaction
   - User pays gas fee (estimated 0.001-0.002 ETH on Base)
   - Transaction submitted to Base network
   - Wait for confirmation (~2-5 seconds on Base)
   - Parse event to get oracle contract address
   - Update database with contract address and tx hash
   - Redirect to dashboard

3. **On Success**:
   - User sees their deployed oracle in dashboard
   - Oracle is registered in OracleRegistry
   - Validators can start submitting data

### Technical Flow

```typescript
// 1. Check wallet connection
if (!isConnected || !address || !walletClient) {
  throw new Error('Wallet not connected');
}

// 2. Create DB record
const oracle = await supabase.from('oracles').insert({...}).single();

// 3. Deploy contract via user's wallet
const provider = new ethers.BrowserProvider(walletClient);
const signer = await provider.getSigner();
const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);

const tx = await factory.deployPriceOracle(
  name,
  symbol,
  consensusThreshold,
  updateFrequency
);

// 4. Wait for confirmation
const receipt = await tx.wait();

// 5. Parse event
const event = receipt.logs.find(e => e.name === 'OracleDeployed');
const contractAddress = event.args.oracleAddress;

// 6. Update DB
await supabase.from('oracles').update({
  contract_address: contractAddress,
  deployment_tx_hash: receipt.hash,
  status: 'active'
}).eq('id', oracle.id);
```

## Benefits

### 1. **Decentralization**
- No centralized deployer wallet
- Users have full ownership (they are msg.sender)
- More aligned with Web3 principles

### 2. **Cost Sustainability**
- Users pay their own gas fees
- No need to fund/manage deployer wallet
- Sustainable business model

### 3. **Security**
- No private keys stored on backend
- No risk of deployer wallet compromise
- Users control their own deployments

### 4. **Transparency**
- Users see exact gas costs before deploying
- Clear who deployed each oracle (wallet address)
- On-chain record of deployment

### 5. **Simplicity**
- No backend deployment infrastructure
- Fewer environment variables
- Less complexity to maintain

## Gas Costs

**Estimated deployment cost on Base:**
- Oracle deployment: ~0.001-0.002 ETH
- Base has very low gas fees (~$0.01-0.05 per deployment)

**User must have:**
- Connected wallet (MetaMask, Coinbase Wallet, etc.)
- Sufficient ETH on Base for gas
- Wallet must be on Base network (8453)

## Error Handling

**Common Errors:**

1. **Wallet not connected**
   - Error: "Please connect your wallet to deploy"
   - Solution: Connect wallet via RainbowKit modal

2. **Insufficient gas**
   - Error: "Insufficient funds for gas"
   - Solution: Bridge ETH to Base or get Base ETH

3. **Wrong network**
   - Error: "Wrong network"
   - Solution: Switch to Base network in wallet

4. **Transaction rejected**
   - Error: "User rejected transaction"
   - Solution: User must approve transaction in wallet

5. **Event not found**
   - Error: "Could not find deployment event"
   - Solution: Check factory contract emits OracleDeployed event

## Database Schema

**Oracles Table:**
```sql
CREATE TABLE oracles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  oracle_type TEXT NOT NULL,
  contract_address TEXT,           -- Set after deployment
  deployment_tx_hash TEXT,          -- Set after deployment
  deployed_at TIMESTAMPTZ,          -- Set after deployment
  status TEXT DEFAULT 'deploying',  -- 'deploying' | 'active' | 'failed'
  config JSONB,
  ...
);
```

**Status Flow:**
1. `deploying` - Oracle record created, contract deployment in progress
2. `active` - Contract deployed successfully, address saved
3. `failed` - Deployment failed (DB updated from client)

## Testing

### Manual Test Steps

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to create oracle:**
   - Go to http://localhost:3000/create-oracle
   - Must be logged in

3. **Complete wizard:**
   - Step 1: Select "Token Price Feed"
   - Step 2: Choose "GeckoTerminal" as data source
   - Step 3: Set update frequency (5 minutes)
   - Step 4: Set consensus threshold (66%)
   - Step 5: Review configuration

4. **Deploy:**
   - Ensure wallet is connected
   - Ensure wallet is on Base network
   - Ensure wallet has ETH for gas
   - Click "Deploy Oracle"
   - Approve transaction in MetaMask
   - Wait for confirmation
   - Should redirect to dashboard

5. **Verify:**
   - Check oracle appears in Supabase `oracles` table
   - Verify `contract_address` is set
   - Verify `deployment_tx_hash` is set
   - Verify `status` is 'active'
   - Check transaction on BaseScan

### Test on Base Testnet First

Before deploying to mainnet, test on Base Sepolia:

1. Update chain ID in code: `chainId: 84532` (Base Sepolia)
2. Deploy factory/registry to Base Sepolia
3. Update environment variables
4. Test full deployment flow
5. Verify contract on Base Sepolia explorer

## Next Steps

Now that deployment is working, the remaining tasks are:

### 1. Fund Validator Wallets (Manual)
Each validator needs 0.01 ETH on Base to submit oracle updates:
- Validator 1: `0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4`
- Validator 2: `0xdd97618068a90c54F128ffFdfc49aa7847A52316`
- Validator 3: `0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C`
- Validator 4: `0xeC4119bCF8378d683dc223056e07c23E5998b8a6`
- Validator 5: `0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c`

### 2. Register Validators in OracleRegistry
Create script to register all 5 validators:
```bash
cd contracts
npx hardhat run scripts/register-all-validators.ts --network base
```

### 3. Set Validators in OracleFactory
Configure factory to use these validators:
```bash
cd contracts
npx hardhat run scripts/setup-factory.ts --network base
```

### 4. Test End-to-End
- Deploy test oracle via UI
- Monitor validator submissions
- Verify consensus mechanism
- Check oracle updates in database

## Migration Notes

If you had existing code calling `/api/oracles/deploy`, it will now:
1. Get HTTP 410 (Gone) error
2. Need to update to use client-side deployment
3. Follow pattern in [app/create-oracle/page.tsx](app/create-oracle/page.tsx)

## Conclusion

The user-paid deployment model is:
- ✅ More decentralized
- ✅ More sustainable
- ✅ More secure
- ✅ More transparent
- ✅ Simpler to maintain

Users now have full control and ownership of their oracle deployments, while FEEDS focuses on providing the infrastructure, validators, and consensus mechanism.
