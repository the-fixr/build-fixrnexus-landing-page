# Oracle System Deployment Checklist

## ✅ Completed Steps

### 1. Smart Contracts Deployed
- ✅ OracleRegistry: `0x9262cDe71f1271Ea542545C7A379E112f904439b`
- ✅ OracleFactory: `0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6`
- ✅ PriceOracle template contract deployed

### 2. Validators Deployed (Cloudflare Workers)
- ✅ Validator 1: https://feeds-validator-1.see21289.workers.dev (`0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4`)
- ✅ Validator 2: https://feeds-validator-2.see21289.workers.dev (`0xdd97618068a90c54F128ffFdfc49aa7847A52316`)
- ✅ Validator 3: https://feeds-validator-3.see21289.workers.dev (`0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C`)
- ✅ Validator 4: https://feeds-validator-4.see21289.workers.dev (`0xeC4119bCF8378d683dc223056e07c23E5998b8a6`)
- ✅ Validator 5: https://feeds-validator-5.see21289.workers.dev (`0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c`)

### 3. Database Schema
- ✅ All tables created with RLS policies
- ✅ Supabase configured and working

### 4. Frontend Implementation
- ✅ Create Oracle wizard (5 steps)
- ✅ Deploy button with client-side deployment
- ✅ User-paid deployment model
- ✅ Wallet connection via RainbowKit
- ✅ Dashboard skeleton

---

## ⏳ Remaining Manual Steps

### Step 1: Fund Validator Wallets (10 minutes)

**Why:** Validators need ETH to submit oracle updates to Base network.

**Amount needed:** 0.01 ETH per validator = **0.05 ETH total on Base**

**Validator addresses:**
```
1. 0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4
2. 0xdd97618068a90c54F128ffFdfc49aa7847A52316
3. 0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C
4. 0xeC4119bCF8378d683dc223056e07c23E5998b8a6
5. 0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c
```

**How to fund:**

1. **Bridge ETH to Base** (if needed):
   - Go to https://bridge.base.org
   - Bridge 0.1 ETH from Ethereum to Base (includes buffer)
   - Wait for confirmation (~5 minutes)

2. **Send ETH to each validator**:
   - Open MetaMask/wallet on Base network
   - Send 0.01 ETH to validator 1
   - Send 0.01 ETH to validator 2
   - Send 0.01 ETH to validator 3
   - Send 0.01 ETH to validator 4
   - Send 0.01 ETH to validator 5

3. **Verify balances** on BaseScan:
   - Check each address has ~0.01 ETH
   - Example: https://basescan.org/address/0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4

**Estimated cost:** $0.15 total (at $3000 ETH)

---

### Step 2: Register Validators in OracleRegistry (5 minutes)

**Why:** OracleRegistry needs to know which validators are authorized.

**Script:** [contracts/scripts/register-all-validators.ts](contracts/scripts/register-all-validators.ts)

**How to run:**

1. **Navigate to contracts directory:**
   ```bash
   cd contracts
   ```

2. **Set environment variables** (if not already in hardhat.config):
   ```bash
   export REGISTRY_ADDRESS=0x9262cDe71f1271Ea542545C7A379E112f904439b
   ```

3. **Run registration script:**
   ```bash
   npx hardhat run scripts/register-all-validators.ts --network base
   ```

4. **Expected output:**
   ```
   Connecting to OracleRegistry at: 0x9262cDe71f1271Ea542545C7A379E112f904439b

   Registering Validator 1: 0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4
   Transaction sent: 0x...
   ✅ Registered successfully

   [... repeats for all 5 validators ...]

   ✅ All validators registered!

   Active Validators: 5
   1. 0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4 (Active)
   2. 0xdd97618068a90c54F128ffFdfc49aa7847A52316 (Active)
   3. 0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C (Active)
   4. 0xeC4119bCF8378d683dc223056e07c23E5998b8a6 (Active)
   5. 0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c (Active)
   ```

5. **Troubleshooting:**
   - If "Validator already registered" appears, that's OK (skip)
   - If "Ownable: caller is not owner", use deployer wallet
   - If gas error, ensure deployer wallet has ETH on Base

**Gas cost:** ~$0.05 total (5 transactions)

---

### Step 3: Set Validators in OracleFactory (5 minutes)

**Why:** Factory needs to know which validators to assign to new oracles.

**Script:** [contracts/scripts/setup-factory.ts](contracts/scripts/setup-factory.ts)

**How to run:**

1. **Navigate to contracts directory** (if not already there):
   ```bash
   cd contracts
   ```

2. **Run setup script:**
   ```bash
   npx hardhat run scripts/setup-factory.ts --network base
   ```

3. **Expected output:**
   ```
   Setting validators in OracleFactory...

   Using account: 0x... (your deployer address)
   Factory address: 0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6

   Setting validators:
     1. 0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4
     2. 0xdd97618068a90c54F128ffFdfc49aa7847A52316
     3. 0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C
     4. 0xeC4119bCF8378d683dc223056e07c23E5998b8a6
     5. 0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c

   Transaction: 0x...
   Waiting for confirmation...
   ✅ Validators set successfully!

   ================================
   SETUP COMPLETE!
   ================================

   Your oracle system is now ready!

   ⚠️  IMPORTANT: Fund each validator with ~0.01 ETH on Base:
     1. 0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4
     [... all validators listed ...]

   Then users can create oracles via the UI at:
     http://localhost:3000/create-oracle
   ```

4. **Troubleshooting:**
   - If "Ownable: caller is not owner", use deployer wallet
   - If validators already set, that's OK
   - If gas error, ensure deployer wallet has ETH on Base

**Gas cost:** ~$0.01 (single transaction)

---

### Step 4: Test Oracle Deployment (15 minutes)

**Why:** Verify the entire system works end-to-end before users start deploying.

**Test flow:**

#### A. Start Frontend

```bash
npm run dev
```

Navigate to http://localhost:3000

#### B. Create Test Oracle

1. **Login** to your account
2. **Connect wallet** (MetaMask on Base network)
3. **Ensure wallet has ETH** for gas (~0.002 ETH)
4. **Navigate to** `/create-oracle`
5. **Complete wizard:**
   - Step 1: Select "Token Price Feed"
   - Step 2: Choose "GeckoTerminal"
   - Step 3: Set 5 minute update frequency
   - Step 4: Set 66% consensus threshold
   - Step 5: Review configuration
6. **Click "Deploy Oracle"**
7. **Approve transaction** in MetaMask
8. **Wait for confirmation** (~5 seconds on Base)
9. **Should redirect** to dashboard

#### C. Verify Deployment

1. **Check Supabase** (`oracles` table):
   ```sql
   SELECT
     id,
     name,
     contract_address,
     deployment_tx_hash,
     status,
     deployed_at
   FROM oracles
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - `contract_address` should be set
   - `status` should be 'active'

2. **Check BaseScan**:
   - Go to https://basescan.org/tx/[deployment_tx_hash]
   - Verify transaction succeeded
   - Check oracle contract at `contract_address`

3. **Check OracleRegistry**:
   ```bash
   cd contracts
   npx hardhat console --network base
   ```
   ```javascript
   const registry = await ethers.getContractAt('OracleRegistry', '0x9262cDe71f1271Ea542545C7A379E112f904439b');
   const oracle = await registry.getOracle('[your_contract_address]');
   console.log(oracle);
   ```
   - Should show oracle details
   - `isActive` should be true

#### D. Monitor Validator Submissions (after 5 minutes)

1. **Check validator health endpoints:**
   ```bash
   curl https://feeds-validator-1.see21289.workers.dev/health
   curl https://feeds-validator-2.see21289.workers.dev/health
   # ... check all 5
   ```

2. **Check oracle contract for price submissions:**
   ```javascript
   const oracle = await ethers.getContractAt('PriceOracle', '[your_contract_address]');
   const latestPrice = await oracle.getLatestPrice();
   console.log('Latest price:', latestPrice.toString());
   ```

3. **Check Supabase** (`oracle_updates` table):
   ```sql
   SELECT
     oracle_id,
     value,
     validator_address,
     block_number,
     created_at
   FROM oracle_updates
   WHERE oracle_id = '[your_oracle_id]'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   - Should see price updates from validators
   - Updates should appear every 5 minutes

#### E. Verify Consensus

After 3+ validators have submitted:

```javascript
const oracle = await ethers.getContractAt('PriceOracle', '[your_contract_address]');

// Check submissions
const submissionCount = await oracle.getCurrentSubmissionCount();
console.log('Submissions:', submissionCount.toString()); // Should be 3-5

// Check consensus
const latestPrice = await oracle.getLatestPrice();
console.log('Consensus price:', ethers.formatUnits(latestPrice, 8));

// Check if oracle needs update
const needsUpdate = await oracle.needsUpdate();
console.log('Needs update:', needsUpdate);
```

---

## 📊 Success Criteria

**System is production-ready when:**

- [x] All 5 validators funded (0.01 ETH each)
- [x] All 5 validators registered in OracleRegistry
- [x] Validators set in OracleFactory
- [x] Test oracle deployed via UI
- [x] Oracle appears in database with contract address
- [x] Oracle registered in OracleRegistry on-chain
- [x] Validators submitting price data every 5 minutes
- [x] Consensus mechanism working (3+ validators agree)
- [x] Price updates stored in `oracle_updates` table
- [x] No errors in validator logs

---

## 🚨 Common Issues

### Issue 1: Validators not submitting

**Symptoms:** No data in `oracle_updates` table after 5 minutes

**Causes:**
- Validators not funded (no ETH for gas)
- Validators not registered in OracleRegistry
- Cron triggers not configured in Cloudflare
- Validator private keys not set in Cloudflare secrets

**Fix:**
1. Check validator balances on BaseScan
2. Run registration script again
3. Check Cloudflare Workers logs
4. Verify secrets are set: `wrangler secret list`

### Issue 2: Consensus not reached

**Symptoms:** Oracle price is 0 or stale

**Causes:**
- Less than 3 validators submitted
- Validator prices differ by >5%
- Consensus threshold too high

**Fix:**
1. Check how many validators submitted
2. Check individual validator submissions
3. Lower consensus threshold to 51%
4. Verify data sources are working

### Issue 3: Deployment fails

**Symptoms:** User gets error when deploying oracle

**Causes:**
- Wallet not connected
- Wrong network (not Base)
- Insufficient ETH for gas
- Factory validators not set

**Fix:**
1. Check wallet connection
2. Switch to Base network (chain ID 8453)
3. Bridge ETH to Base
4. Run setup-factory.ts script

---

## 📈 Monitoring

### Validator Health

Check all validators are responding:
```bash
for i in {1..5}; do
  echo "Validator $i:"
  curl -s https://feeds-validator-$i.see21289.workers.dev/health | jq
  echo ""
done
```

### Oracle Activity

Check recent oracle deployments:
```sql
SELECT
  COUNT(*) as total_oracles,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_oracles,
  COUNT(CASE WHEN deployed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as deployed_today
FROM oracles;
```

### Validator Submissions

Check submission rate:
```sql
SELECT
  validator_address,
  COUNT(*) as submissions_24h,
  MAX(created_at) as last_submission
FROM oracle_updates
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY validator_address;
```

---

## 🎯 Next Steps After Production

### 1. Add More Oracle Templates
- Implement Farcaster oracle validator logic
- Implement Liquidity oracle validator logic
- Test with real Neynar API

### 2. Build Dashboard Features
- "My Oracles" page showing user's deployed oracles
- Real-time price/data updates
- Validator health monitoring
- Oracle analytics and metrics

### 3. Add Monitoring & Alerts
- Discord/Telegram notifications
- Validator downtime alerts
- Low balance warnings
- Failed submission tracking

### 4. Optimize Costs
- Batch validator submissions
- Adjust update frequencies
- Implement validator rotation
- Gas usage analytics

---

## 💰 Cost Summary

**One-time setup costs:**
- Fund 5 validators: 0.05 ETH (~$150)
- Register validators: ~$0.05
- Setup factory: ~$0.01
- **Total:** 0.05 ETH + ~$0.06 = **~$150**

**Ongoing costs:**
- Per oracle deployment (user pays): ~0.001 ETH (~$3)
- Per validator submission: ~0.0001 ETH (~$0.30)
- With 5min updates: ~$86/month per oracle per validator
- **Total per oracle:** ~$430/month (5 validators)

**Revenue model:**
- Free tier: Up to 1 oracle (you cover costs)
- Starter ($29/mo): Up to 5 oracles (subsidized)
- Pro ($99/mo): Unlimited oracles (profitable)

---

## ✅ Final Checklist

Before launching to users:

- [ ] Fund all 5 validators (0.01 ETH each)
- [ ] Register all validators in OracleRegistry
- [ ] Set validators in OracleFactory
- [ ] Deploy test oracle successfully
- [ ] Verify validators submitting data
- [ ] Verify consensus mechanism working
- [ ] Test error handling (wrong network, insufficient gas)
- [ ] Add monitoring dashboard
- [ ] Set up alerts for validator downtime
- [ ] Document user guide
- [ ] Test on mobile (MetaMask Mobile)
- [ ] Add analytics tracking
- [ ] Set up customer support channel

**When all above are checked, you're ready to launch! 🚀**
