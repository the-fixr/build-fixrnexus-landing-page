// Get the price oracle ID for manual fix
const { createClient } = require('@supabase/supabase-js');
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

async function getOracleId() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: oracles } = await supabase
    .from('oracles')
    .select('id, name, oracle_type, deployment_tx_hash')
    .eq('oracle_type', 'price')
    .eq('deployment_tx_hash', '0xf3156765befbe48f3c3ff677a2aa899740e1dae1516db3d4686aca4fa43f3dd1')
    .single();

  if (oracles) {
    console.log('Price Oracle Details:');
    console.log('  Name:', oracles.name || '(unnamed)');
    console.log('  ID:', oracles.id);
    console.log('  TX:', oracles.deployment_tx_hash);
    console.log('');
    console.log('Run this command to fix it:');
    console.log(`node manual-fix-oracle.js ${oracles.deployment_tx_hash} ${oracles.id}`);
  } else {
    console.log('Oracle not found');
  }
}

getOracleId();
