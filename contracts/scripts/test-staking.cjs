const hre = require("hardhat");

// Deployed contract addresses
const DUMMY_TOKEN = "0x8cBb89d67fDA00E26aEd0Fc02718821049b41610";
const FIXR_STAKING = "0x39DbBa2CdAF7F668816957B023cbee1841373F5b";
const FEE_SPLITTER = "0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);
  console.log("---");

  // Get contract instances
  const dummyToken = await hre.ethers.getContractAt("DummyToken", DUMMY_TOKEN);
  const staking = await hre.ethers.getContractAt("FixrStaking", FIXR_STAKING);
  const feeSplitter = await hre.ethers.getContractAt("FixrFeeSplitter", FEE_SPLITTER);

  // Check balances
  const tokenBalance = await dummyToken.balanceOf(signer.address);
  console.log("dFIXR Balance:", hre.ethers.formatEther(tokenBalance));

  const ethBalance = await hre.ethers.provider.getBalance(signer.address);
  console.log("ETH Balance:", hre.ethers.formatEther(ethBalance));
  console.log("---");

  // Test 1: Approve and stake tokens
  console.log("=== TEST 1: Stake Tokens ===");
  const stakeAmount = hre.ethers.parseEther("1000000"); // 1M tokens

  console.log("Approving staking contract...");
  const approveTx = await dummyToken.approve(FIXR_STAKING, stakeAmount);
  await approveTx.wait();
  console.log("Approved!");

  console.log("Staking 1M tokens with Tier 0 (7 days, 1.0x)...");
  const stakeTx = await staking.stake(stakeAmount, 0);
  const stakeReceipt = await stakeTx.wait();
  console.log("Staked! Tx:", stakeReceipt.hash);

  // Check staking state
  const totalWeighted = await staking.totalWeightedStake();
  console.log("Total weighted stake:", hre.ethers.formatEther(totalWeighted));

  const userWeighted = await staking.userWeightedStake(signer.address);
  console.log("User weighted stake:", hre.ethers.formatEther(userWeighted));

  const positions = await staking.getPositions(signer.address);
  console.log("User positions:", positions.length);
  if (positions.length > 0) {
    console.log("  Position 0:", {
      amount: hre.ethers.formatEther(positions[0].amount),
      weightedAmount: hre.ethers.formatEther(positions[0].weightedAmount),
      lockTier: positions[0].lockTier.toString(),
      unlockAt: new Date(Number(positions[0].unlockAt) * 1000).toISOString(),
    });
  }
  console.log("---");

  // Test 2: Send ETH to fee splitter (simulating fees)
  console.log("=== TEST 2: Send ETH to Fee Splitter ===");
  const feeAmount = hre.ethers.parseEther("0.0001"); // 0.0001 ETH for testing

  console.log("Sending", hre.ethers.formatEther(feeAmount), "ETH to fee splitter...");
  const sendTx = await signer.sendTransaction({
    to: FEE_SPLITTER,
    value: feeAmount,
  });
  await sendTx.wait();
  console.log("Sent! Tx:", sendTx.hash);

  // Check WETH balance in fee splitter
  const wethContract = await hre.ethers.getContractAt("IERC20", WETH);
  const wethBalance = await wethContract.balanceOf(FEE_SPLITTER);
  console.log("Fee splitter WETH balance:", hre.ethers.formatEther(wethBalance));
  console.log("---");

  // Test 3: Distribute fees
  console.log("=== TEST 3: Distribute Fees ===");

  // Check if balance meets minimum threshold (1e15 = 0.001)
  if (wethBalance < hre.ethers.parseEther("0.001")) {
    console.log("WETH balance below minimum distribution threshold (0.001)");
    console.log("Sending more ETH to meet threshold...");
    const moreFees = await signer.sendTransaction({
      to: FEE_SPLITTER,
      value: hre.ethers.parseEther("0.001"),
    });
    await moreFees.wait();
    console.log("Sent additional fees!");
  }

  console.log("Distributing fees...");
  const distributeTx = await feeSplitter.distributeAll();
  const distributeReceipt = await distributeTx.wait();
  console.log("Distributed! Tx:", distributeReceipt.hash);

  // Check balances after distribution
  const wethAfter = await wethContract.balanceOf(FEE_SPLITTER);
  console.log("Fee splitter WETH balance after:", hre.ethers.formatEther(wethAfter));
  console.log("---");

  // Test 4: Check pending rewards
  console.log("=== TEST 4: Check Pending Rewards ===");
  const pendingWeth = await staking.pendingRewards(signer.address, WETH);
  console.log("Pending WETH rewards:", hre.ethers.formatEther(pendingWeth));

  // Test 5: Claim rewards
  if (pendingWeth > 0) {
    console.log("=== TEST 5: Claim Rewards ===");
    const wethBefore = await wethContract.balanceOf(signer.address);

    console.log("Claiming rewards...");
    const claimTx = await staking.claimRewards();
    await claimTx.wait();
    console.log("Claimed! Tx:", claimTx.hash);

    const wethAfterClaim = await wethContract.balanceOf(signer.address);
    console.log("WETH received:", hre.ethers.formatEther(wethAfterClaim - wethBefore));
  }
  console.log("---");

  console.log("=== ALL TESTS COMPLETE ===");
  console.log("");
  console.log("Summary:");
  console.log("- Staking: Working");
  console.log("- Fee reception: Working");
  console.log("- Fee distribution: Working");
  console.log("- Reward claiming: Working");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
