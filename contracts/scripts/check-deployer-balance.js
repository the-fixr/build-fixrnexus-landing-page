const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.log("\n⚠️  DEPLOYER HAS NO ETH!");
    console.log("Send some ETH to:", deployer.address);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
