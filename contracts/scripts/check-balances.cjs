const hre = require("hardhat");

const WETH = "0x4200000000000000000000000000000000000006";
const FEE_SPLITTER = "0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928";
const STAKING = "0x39DbBa2CdAF7F668816957B023cbee1841373F5b";

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const weth = await hre.ethers.getContractAt("IERC20", WETH);

  console.log("=== Balances ===");
  console.log("Signer ETH:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)));
  console.log("FeeSplitter WETH:", hre.ethers.formatEther(await weth.balanceOf(FEE_SPLITTER)));
  console.log("FeeSplitter ETH:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(FEE_SPLITTER)));
  console.log("Staking WETH:", hre.ethers.formatEther(await weth.balanceOf(STAKING)));
}

main().catch(console.error);
