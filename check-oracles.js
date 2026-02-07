// Check which oracles have contract addresses
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

async function checkOracles() {
  console.log('Checking oracles...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: oracles, error } = await supabase
      .from('oracles')
      .select('id, name, oracle_type, contract_address, deployment_tx_hash, target_token, status, is_hidden')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    if (!oracles || oracles.length === 0) {
      console.log('⚠️  No oracles found in database');
      console.log('\nCreate an oracle at: http://localhost:3000/create-oracle');
      process.exit(0);
    }

    console.log(`Found ${oracles.length} oracle(s):\n`);

    const deployed = oracles.filter(o => o.contract_address);
    const notDeployed = oracles.filter(o => !o.contract_address);

    if (deployed.length > 0) {
      console.log('✅ DEPLOYED ORACLES (will show jazzicons):');
      console.log('─'.repeat(80));
      deployed.forEach((o, i) => {
        console.log(`${i + 1}. ${o.name}`);
        console.log(`   Type: ${o.oracle_type}`);
        console.log(`   Address: ${o.contract_address}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   Hidden: ${o.is_hidden ? 'YES' : 'NO'}`);
        if (o.target_token) console.log(`   Token: ${o.target_token}`);
        console.log('');
      });
    }

    if (notDeployed.length > 0) {
      console.log('⚠️  NOT DEPLOYED (won\'t show jazzicons yet):');
      console.log('─'.repeat(80));
      notDeployed.forEach((o, i) => {
        console.log(`${i + 1}. ${o.name}`);
        console.log(`   Type: ${o.oracle_type}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   TX Hash: ${o.deployment_tx_hash || 'None (deployment never started)'}`);
        console.log(`   Why: ${o.deployment_tx_hash ? 'TX sent but address not saved to DB' : 'Deployment never started or failed before TX'}`);
        console.log('');
      });
    }

    console.log('─'.repeat(80));
    console.log(`\nSummary:`);
    console.log(`  Total: ${oracles.length}`);
    console.log(`  Deployed: ${deployed.length} (will show jazzicons)`);
    console.log(`  Not deployed: ${notDeployed.length} (won't show jazzicons yet)`);

    if (notDeployed.length > 0) {
      console.log(`\n💡 Tip: Deploy an oracle to see jazzicons!`);
      console.log(`   Go to: http://localhost:3000/create-oracle`);
    }

    if (deployed.length > 0) {
      console.log(`\n✨ Jazzicons should be visible for deployed oracles!`);
      console.log(`   Open: http://localhost:3000/dashboard`);
      console.log(`   Look for colorful circle avatars next to oracle names`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkOracles();
