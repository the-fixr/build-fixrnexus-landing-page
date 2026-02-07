// Script to find deployed oracle addresses from tx hashes and update database
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const factoryAbi = [
  'event OracleDeployed(address indexed oracleAddress, address indexed creator, string name, string symbol)'
];

async function fixOracleAddresses() {
  console.log('🔍 Searching for deployed oracle addresses...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com'
  );

  const factoryAddress = process.env.NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS;
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

  try {
    // Get oracles without contract_address but with deployment_tx_hash
    const { data: oracles, error } = await supabase
      .from('oracles')
      .select('*')
      .is('contract_address', null)
      .not('deployment_tx_hash', 'is', null);

    if (error) {
      console.error('❌ Error fetching oracles:', error.message);
      process.exit(1);
    }

    if (!oracles || oracles.length === 0) {
      console.log('⚠️  No oracles found with tx_hash but missing contract_address');
      console.log('\n💡 If you have oracles stuck in "deploying" status:');
      console.log('   1. They might not have deployment_tx_hash saved');
      console.log('   2. Check browser console during deployment for errors');
      console.log('   3. You may need to re-deploy them');
      process.exit(0);
    }

    console.log(`Found ${oracles.length} oracle(s) to fix:\n`);

    for (const oracle of oracles) {
      console.log(`\nProcessing: ${oracle.name}`);
      console.log(`  TX Hash: ${oracle.deployment_tx_hash}`);

      try {
        const receipt = await provider.getTransactionReceipt(oracle.deployment_tx_hash);

        if (!receipt) {
          console.log(`  ⚠️  Transaction not found or not confirmed yet`);
          continue;
        }

        console.log(`  ✅ Transaction confirmed`);

        // Parse logs for OracleDeployed event
        const deployEvent = receipt.logs
          .map(log => {
            try {
              return factory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find(e => e && e.name === 'OracleDeployed');

        if (!deployEvent) {
          console.log(`  ❌ Could not find OracleDeployed event`);
          console.log(`     This might not be an oracle deployment tx`);
          continue;
        }

        const contractAddress = deployEvent.args.oracleAddress;
        console.log(`  📍 Oracle Address: ${contractAddress}`);

        // Update database
        const { error: updateError } = await supabase
          .from('oracles')
          .update({
            contract_address: contractAddress,
            deployed_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', oracle.id);

        if (updateError) {
          console.log(`  ❌ Failed to update database: ${updateError.message}`);
        } else {
          console.log(`  ✅ Database updated successfully!`);
        }

      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('✨ Done! Check your dashboard: http://localhost:3000/dashboard');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixOracleAddresses();
