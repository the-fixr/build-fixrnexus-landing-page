// Generate 5 validator wallets for FEEDS oracle network
const { Wallet } = require('ethers');

console.log('');
console.log('='.repeat(80));
console.log('FEEDS ORACLE VALIDATORS - Wallet Generation');
console.log('='.repeat(80));
console.log('');
console.log('⚠️  SECURITY WARNING: Save these private keys securely!');
console.log('⚠️  Each validator needs ~0.01 ETH on Base network for gas');
console.log('');

const validators = [];

for (let i = 1; i <= 5; i++) {
  const wallet = Wallet.createRandom();
  validators.push({
    index: i,
    address: wallet.address,
    privateKey: wallet.privateKey,
  });

  console.log(`Validator ${i}:`);
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Private Key: ${wallet.privateKey}`);
  console.log('');
}

console.log('='.repeat(80));
console.log('NEXT STEPS:');
console.log('='.repeat(80));
console.log('');
console.log('1. Fund each address with 0.01 ETH on Base:');
console.log('   https://bridge.base.org/');
console.log('');
console.log('2. Deploy Cloudflare Workers:');
console.log('   wrangler deploy --env validator-1');
console.log('   wrangler deploy --env validator-2');
console.log('   wrangler deploy --env validator-3');
console.log('   wrangler deploy --env validator-4');
console.log('   wrangler deploy --env validator-5');
console.log('');
console.log('3. Set secrets for each worker:');
validators.forEach((v) => {
  console.log(`   echo "${v.privateKey}" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-${v.index}`);
});
console.log('');
console.log('4. Register validators in Registry contract on Basescan:');
console.log('   Registry: 0x9262cDe71f1271Ea542545C7A379E112f904439b');
console.log('');
console.log('5. Set validators in Factory contract:');
console.log('   Factory: 0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6');
console.log('');
console.log('   setValidators([');
validators.forEach((v, i) => {
  const comma = i < validators.length - 1 ? ',' : '';
  console.log(`     "${v.address}"${comma}`);
});
console.log('   ])');
console.log('');
