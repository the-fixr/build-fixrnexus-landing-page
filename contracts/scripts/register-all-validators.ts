import { ethers } from 'hardhat';

const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || '0x9262cDe71f1271Ea542545C7A379E112f904439b';

const VALIDATORS = [
  {
    index: 0,
    address: '0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4',
    endpoint: 'https://feeds-validator-1.see21289.workers.dev'
  },
  {
    index: 1,
    address: '0xdd97618068a90c54F128ffFdfc49aa7847A52316',
    endpoint: 'https://feeds-validator-2.see21289.workers.dev'
  },
  {
    index: 2,
    address: '0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C',
    endpoint: 'https://feeds-validator-3.see21289.workers.dev'
  },
  {
    index: 3,
    address: '0xeC4119bCF8378d683dc223056e07c23E5998b8a6',
    endpoint: 'https://feeds-validator-4.see21289.workers.dev'
  },
  {
    index: 4,
    address: '0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c',
    endpoint: 'https://feeds-validator-5.see21289.workers.dev'
  }
];

async function main() {
  console.log('Connecting to OracleRegistry at:', REGISTRY_ADDRESS);

  const registry = await ethers.getContractAt('OracleRegistry', REGISTRY_ADDRESS);

  for (const validator of VALIDATORS) {
    console.log(`\nRegistering Validator ${validator.index + 1}:`, validator.address);

    try {
      const tx = await registry.addValidator(
        validator.index,
        validator.address,
        validator.endpoint
      );

      console.log('Transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Registered successfully');
    } catch (error: any) {
      if (error.message.includes('Validator already registered')) {
        console.log('⚠️  Already registered, skipping');
      } else {
        console.error('❌ Error:', error.message);
      }
    }
  }

  console.log('\n✅ All validators registered!');

  // Verify
  const activeValidators = await registry.getActiveValidators();
  console.log('\nActive Validators:', activeValidators.length);
  activeValidators.forEach((v: any, i: number) => {
    console.log(`${i + 1}. ${v.validatorAddress} (${v.isActive ? 'Active' : 'Inactive'})`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
