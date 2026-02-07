import { ethers } from 'hardhat';

async function main() {
  console.log('Testing connection to Base network...');

  const [signer] = await ethers.getSigners();
  console.log('Signer address:', signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  const network = await ethers.provider.getNetwork();
  console.log('Network:', network.name, 'Chain ID:', network.chainId);

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log('Current block:', blockNumber);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
