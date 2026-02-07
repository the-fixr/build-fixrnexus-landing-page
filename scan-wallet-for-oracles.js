// Scan a wallet address for oracle deployments and auto-fix database
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

async function scanWallet() {
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.log('Usage: node scan-wallet-for-oracles.js <wallet_address>');
    console.log('');
    console.log('Example:');
    console.log('  node scan-wallet-for-oracles.js 0x742d35Cc6634C0532925a3b8...');
    console.log('');
    console.log('This will scan for all oracle deployments from your wallet');
    console.log('and automatically match them to oracles in the database.');
    process.exit(1);
  }

  console.log(`🔍 Scanning wallet for oracle deployments: ${walletAddress}\n`);

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
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Scan last 500,000 blocks in chunks of 40,000 (RPC limit is 50k)
    const totalBlocks = 500000;
    const chunkSize = 40000;
    const fromBlock = Math.max(0, currentBlock - totalBlocks);
    console.log(`Scanning from block ${fromBlock} to ${currentBlock} (last ~2-3 weeks)...\n`);

    // Query for OracleDeployed events from this wallet in chunks
    const filter = factory.filters.OracleDeployed(null, walletAddress);
    let events = [];

    for (let start = fromBlock; start < currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize, currentBlock);
      console.log(`  Scanning blocks ${start} to ${end}...`);
      const chunkEvents = await factory.queryFilter(filter, start, end);
      events = events.concat(chunkEvents);
      if (chunkEvents.length > 0) {
        console.log(`  Found ${chunkEvents.length} event(s) in this chunk`);
      }
    }
    console.log();

    if (events.length === 0) {
      console.log('❌ No oracle deployments found from this wallet');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. Wrong wallet address');
      console.log('  2. Deployments were more than ~100k blocks ago');
      console.log('  3. Deployments used a different factory contract');
      console.log('');
      console.log(`Current factory: ${factoryAddress}`);
      process.exit(0);
    }

    console.log(`✅ Found ${events.length} oracle deployment(s)!\n`);
    console.log('─'.repeat(80));

    // Get oracles from database that need fixing
    const { data: oracles, error: dbError } = await supabase
      .from('oracles')
      .select('*')
      .is('contract_address', null)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('❌ Database error:', dbError.message);
      process.exit(1);
    }

    const oraclesToFix = oracles || [];
    console.log(`Database has ${oraclesToFix.length} oracle(s) without addresses\n`);

    // Process each event
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const oracleAddress = event.args.oracleAddress;
      const name = event.args.name;
      const symbol = event.args.symbol;
      const tx = event.transactionHash;

      console.log(`\n${i + 1}. Oracle Deployed:`);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Address: ${oracleAddress}`);
      console.log(`   TX: ${tx}`);
      console.log(`   Block: ${event.blockNumber}`);

      // Try to match with database oracle
      const matchingOracle = oraclesToFix.find(o =>
        o.name.toLowerCase() === name.toLowerCase() ||
        o.symbol?.toLowerCase() === symbol.toLowerCase()
      );

      if (!matchingOracle) {
        console.log(`   ⚠️  No matching oracle found in database`);
        continue;
      }

      console.log(`   ✅ Matched to database oracle: ${matchingOracle.id}`);

      // Update database
      const { error: updateError } = await supabase
        .from('oracles')
        .update({
          contract_address: oracleAddress,
          deployment_tx_hash: tx,
          deployed_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', matchingOracle.id);

      if (updateError) {
        console.log(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Database updated!`);
        // Remove from list so it doesn't match again
        const index = oraclesToFix.indexOf(matchingOracle);
        if (index > -1) oraclesToFix.splice(index, 1);
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('🎉 Scan complete!');
    console.log('');
    console.log('View dashboard: http://localhost:3000/dashboard');
    console.log('Jazzicons should now be visible! 🎨');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

scanWallet();
