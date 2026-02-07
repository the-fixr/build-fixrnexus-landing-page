import { ethers } from 'hardhat';

async function main() {
  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || '0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64';

  console.log('🏭 Redeploying OracleFactory with FarcasterOracle support...');
  console.log('Registry:', REGISTRY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  // Deploy OracleFactory
  const OracleFactory = await ethers.getContractFactory('OracleFactory');
  const factory = await OracleFactory.deploy(REGISTRY_ADDRESS);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log('\n✅ OracleFactory deployed to:', factoryAddress);

  console.log('\n🔗 Verify on BaseScan:');
  console.log(`https://basescan.org/address/${factoryAddress}`);

  console.log('\n📝 Update .env.local with:');
  console.log(`NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS=${factoryAddress}`);

  console.log('\n⚠️  Next steps:');
  console.log('1. Update .env.local with new factory address');
  console.log('2. Run setup-factory.ts to set validators in new factory');
  console.log('3. Update OracleRegistry to allow new factory to register oracles');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
