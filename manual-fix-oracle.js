// Manually fix oracle address from a transaction hash
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

async function manualFix() {
  // Get transaction hash from command line
  const txHash = process.argv[2];
  const oracleId = process.argv[3];

  if (!txHash || !oracleId) {
    console.log('Usage: node manual-fix-oracle.js <tx_hash> <oracle_id>');
    console.log('');
    console.log('Example:');
    console.log('  node manual-fix-oracle.js 0xabc123... bb25a0c2-2deb-4377-a175-66314742776c');
    console.log('');
    console.log('To find oracle IDs, run: node check-oracles.js');
    process.exit(1);
  }

  console.log(`🔍 Looking up transaction: ${txHash}\n`);

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
    // Get the transaction receipt
    console.log('Fetching transaction receipt...');
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.error('❌ Transaction not found or not confirmed yet');
      console.log('   Make sure the transaction is on Base mainnet and has been confirmed');
      process.exit(1);
    }

    console.log('✅ Transaction found');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

    if (receipt.status !== 1) {
      console.error('❌ Transaction failed on-chain');
      process.exit(1);
    }

    // Parse logs for OracleDeployed event
    console.log('\nParsing logs for OracleDeployed event...');
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
      console.error('❌ Could not find OracleDeployed event');
      console.log('   This might not be an oracle deployment transaction');
      console.log('   Or the factory address might be wrong');
      process.exit(1);
    }

    const contractAddress = deployEvent.args.oracleAddress;
    const creator = deployEvent.args.creator;
    const name = deployEvent.args.name;
    const symbol = deployEvent.args.symbol;

    console.log('✅ Found OracleDeployed event:');
    console.log(`   Oracle Address: ${contractAddress}`);
    console.log(`   Creator: ${creator}`);
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);

    // Check if oracle exists
    console.log(`\nChecking oracle in database (ID: ${oracleId})...`);
    const { data: oracle, error: fetchError } = await supabase
      .from('oracles')
      .select('*')
      .eq('id', oracleId)
      .single();

    if (fetchError || !oracle) {
      console.error('❌ Oracle not found in database');
      console.log('   Run: node check-oracles.js to see available oracle IDs');
      process.exit(1);
    }

    console.log('✅ Oracle found in database:');
    console.log(`   Name: ${oracle.name}`);
    console.log(`   Type: ${oracle.oracle_type}`);
    console.log(`   Current Address: ${oracle.contract_address || 'None'}`);

    // Update database
    console.log('\nUpdating database...');
    const { error: updateError } = await supabase
      .from('oracles')
      .update({
        contract_address: contractAddress,
        deployment_tx_hash: txHash,
        deployed_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', oracleId);

    if (updateError) {
      console.error(`❌ Failed to update database: ${updateError.message}`);
      process.exit(1);
    }

    console.log('✅ Database updated successfully!');
    console.log('');
    console.log('─'.repeat(80));
    console.log('🎉 Oracle fixed!');
    console.log('');
    console.log('View on BaseScan:');
    console.log(`  https://basescan.org/address/${contractAddress}`);
    console.log('');
    console.log('View in dashboard:');
    console.log(`  http://localhost:3000/dashboard`);
    console.log('');
    console.log('Jazzicons should now be visible! 🎨');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

manualFix();
