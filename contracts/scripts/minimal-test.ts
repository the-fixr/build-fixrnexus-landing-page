import { ethers } from 'hardhat';

async function main() {
  console.log('START');
  console.log('Getting signers...');
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);
  console.log('DONE');
}

main()
  .then(() => {
    console.log('Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('ERROR:', error.message);
    process.exit(1);
  });
