const hre = require("hardhat");

const WETH = "0x4200000000000000000000000000000000000006";
const FEE_SPLITTER = "0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928";
const STAKING = "0x39DbBa2CdAF7F668816957B023cbee1841373F5b";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const weth = await hre.ethers.getContractAt("IERC20", WETH);
  const feeSplitter = await hre.ethers.getContractAt("FixrFeeSplitter", FEE_SPLITTER);
  const staking = await hre.ethers.getContractAt("FixrStaking", STAKING);

  // Check current WETH balance
  let wethBalance = await weth.balanceOf(FEE_SPLITTER);
  console.log("Current WETH in FeeSplitter:", hre.ethers.formatEther(wethBalance));

  // Send more ETH if needed to meet threshold
  const minDistribution = hre.ethers.parseEther("0.001");
  if (wethBalance < minDistribution) {
    const needed = minDistribution - wethBalance + hre.ethers.parseEther("0.0001"); // Add buffer
    console.log("Sending", hre.ethers.formatEther(needed), "ETH to meet threshold...");
    const tx = await signer.sendTransaction({
      to: FEE_SPLITTER,
      value: needed,
    });
    await tx.wait();
    console.log("Sent! Tx:", tx.hash);

    wethBalance = await weth.balanceOf(FEE_SPLITTER);
    console.log("New WETH balance:", hre.ethers.formatEther(wethBalance));
  }

  // Distribute fees
  console.log("\nDistributing fees (70% stakers, 30% treasury)...");
  const distributeTx = await feeSplitter.distributeAll();
  const receipt = await distributeTx.wait();
  console.log("Distributed! Tx:", receipt.hash);

  // Check balances after
  console.log("\n=== After Distribution ===");
  console.log("FeeSplitter WETH:", hre.ethers.formatEther(await weth.balanceOf(FEE_SPLITTER)));
  console.log("Staking WETH:", hre.ethers.formatEther(await weth.balanceOf(STAKING)));
  console.log("Treasury WETH:", hre.ethers.formatEther(await weth.balanceOf(signer.address)));

  // Check pending rewards
  const pending = await staking.pendingRewards(signer.address, WETH);
  console.log("\nPending WETH rewards for staker:", hre.ethers.formatEther(pending));

  if (pending > 0) {
    console.log("\nClaiming rewards...");
    const claimTx = await staking.claimRewards();
    await claimTx.wait();
    console.log("Claimed!");

    console.log("\n=== Final State ===");
    console.log("User WETH balance:", hre.ethers.formatEther(await weth.balanceOf(signer.address)));
  }
}

main().catch(console.error);
