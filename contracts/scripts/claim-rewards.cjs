const hre = require("hardhat");

const WETH = "0x4200000000000000000000000000000000000006";
const STAKING = "0x39DbBa2CdAF7F668816957B023cbee1841373F5b";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const weth = await hre.ethers.getContractAt("IERC20", WETH);
  const staking = await hre.ethers.getContractAt("FixrStaking", STAKING);

  console.log("User:", signer.address);
  console.log("User WETH before:", hre.ethers.formatEther(await weth.balanceOf(signer.address)));

  const pending = await staking.pendingRewards(signer.address, WETH);
  console.log("Pending WETH rewards:", hre.ethers.formatEther(pending));

  if (pending > 0) {
    console.log("\nClaiming rewards...");
    const tx = await staking.claimRewards();
    await tx.wait();
    console.log("Claimed!");
    console.log("User WETH after:", hre.ethers.formatEther(await weth.balanceOf(signer.address)));
  } else {
    console.log("No rewards to claim");

    // Debug: check reward state
    console.log("\n=== Debug Info ===");
    console.log("WETH in staking:", hre.ethers.formatEther(await weth.balanceOf(STAKING)));
    console.log("User weighted stake:", hre.ethers.formatEther(await staking.userWeightedStake(signer.address)));
    console.log("Total weighted stake:", hre.ethers.formatEther(await staking.totalWeightedStake()));
  }
}

main().catch(console.error);
