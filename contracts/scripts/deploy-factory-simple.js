const hre = require('hardhat');

async function main() {
  const REGISTRY_ADDRESS = '0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64';

  console.log('Deploying OracleFactory...');

  const OracleFactory = await hre.ethers.getContractFactory('OracleFactory');
  const factory = await OracleFactory.deploy(REGISTRY_ADDRESS);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log('OracleFactory deployed to:', factoryAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
