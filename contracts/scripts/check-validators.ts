import { ethers } from 'hardhat';

const REGISTRY_ADDRESS = '0x9262cDe71f1271Ea542545C7A379E112f904439b';

async function main() {
  console.log('Checking OracleRegistry at:', REGISTRY_ADDRESS);

  const registry = await ethers.getContractAt('OracleRegistry', REGISTRY_ADDRESS);

  try {
    const activeValidators = await registry.getActiveValidators();
    console.log('\nActive Validators:', activeValidators.length);

    activeValidators.forEach((v: any, i: number) => {
      console.log(`${i + 1}. ${v.validatorAddress} (${v.isActive ? 'Active' : 'Inactive'})`);
      console.log(`   Endpoint: ${v.endpoint}`);
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
