const hre = require("hardhat");

const WETH = "0x4200000000000000000000000000000000000006";
const FEE_SPLITTER = "0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928";
const STAKING = "0x39DbBa2CdAF7F668816957B023cbee1841373F5b";
const TREASURY = "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const weth = await hre.ethers.getContractAt("IERC20", WETH);
  const feeSplitter = await hre.ethers.getContractAt("FixrFeeSplitter", FEE_SPLITTER);
  const staking = await hre.ethers.getContractAt("FixrStaking", STAKING);

  console.log("=== Fee Splitter State ===");
  console.log("Staking contract:", await feeSplitter.stakingContract());
  console.log("Treasury:", await feeSplitter.treasury());
  console.log("WETH whitelisted:", await feeSplitter.isWhitelisted(WETH));
  console.log("Whitelisted tokens:", await feeSplitter.getWhitelistedTokens());
  console.log("WETH balance:", hre.ethers.formatEther(await weth.balanceOf(FEE_SPLITTER)));

  console.log("\n=== Staking State ===");
  console.log("Total weighted stake:", hre.ethers.formatEther(await staking.totalWeightedStake()));
  console.log("User weighted stake:", hre.ethers.formatEther(await staking.userWeightedStake(signer.address)));
  console.log("WETH is reward token:", await staking.isRewardToken(WETH));
  console.log("Reward tokens:", await staking.getRewardTokens());
  console.log("WETH balance:", hre.ethers.formatEther(await weth.balanceOf(STAKING)));

  console.log("\n=== Balances ===");
  console.log("Treasury WETH:", hre.ethers.formatEther(await weth.balanceOf(TREASURY)));

  // Try to manually distribute
  console.log("\n=== Attempting Manual Distribution ===");
  const balance = await weth.balanceOf(FEE_SPLITTER);
  const minDist = hre.ethers.parseEther("0.001");

  if (balance >= minDist) {
    console.log("Balance meets threshold, distributing...");
    try {
      const tx = await feeSplitter.distribute(WETH);
      const receipt = await tx.wait();
      console.log("Distribution tx:", receipt.hash);

      // Check events
      for (const log of receipt.logs) {
        try {
          const parsed = feeSplitter.interface.parseLog(log);
          if (parsed) {
            console.log("Event:", parsed.name, parsed.args);
          }
        } catch (e) {
          // Not a FeeSplitter event
        }
      }
    } catch (e) {
      console.log("Distribution error:", e.message);
    }
  } else {
    console.log("Balance below threshold:", hre.ethers.formatEther(balance));
  }
}

main().catch(console.error);
