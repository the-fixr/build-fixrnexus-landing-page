const hre = require("hardhat");

// Configuration
const TREASURY_ADDRESS = "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4";
const WETH_BASE = "0x4200000000000000000000000000000000000006";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("---");

  // Check if we're using a dummy token or real FIXR
  const USE_DUMMY_TOKEN = process.env.USE_DUMMY_TOKEN === "true";
  let fixrTokenAddress;

  if (USE_DUMMY_TOKEN) {
    // Check if dummy token already exists
    if (process.env.DUMMY_TOKEN_ADDRESS) {
      fixrTokenAddress = process.env.DUMMY_TOKEN_ADDRESS;
      console.log("Step 1: Using existing DummyToken:", fixrTokenAddress);
      console.log("---");
    } else {
      // Step 1: Deploy DummyToken
      console.log("Step 1: Deploying DummyToken...");
      const DummyToken = await hre.ethers.getContractFactory("DummyToken");
      const dummyToken = await DummyToken.deploy(deployer.address);
      await dummyToken.waitForDeployment();
      fixrTokenAddress = await dummyToken.getAddress();
      console.log("DummyToken deployed to:", fixrTokenAddress);
      console.log("---");
    }
  } else {
    // Use real FIXR token address from env
    fixrTokenAddress = process.env.FIXR_TOKEN_ADDRESS;
    if (!fixrTokenAddress) {
      throw new Error("FIXR_TOKEN_ADDRESS not set. Set USE_DUMMY_TOKEN=true to deploy with dummy token.");
    }
    console.log("Using existing FIXR token:", fixrTokenAddress);
    console.log("---");
  }

  // Step 2: Deploy FixrStaking
  console.log("Step 2: Deploying FixrStaking...");
  const FixrStaking = await hre.ethers.getContractFactory("FixrStaking");
  const fixrStaking = await FixrStaking.deploy(fixrTokenAddress, deployer.address);
  await fixrStaking.waitForDeployment();
  const stakingAddress = await fixrStaking.getAddress();
  console.log("FixrStaking deployed to:", stakingAddress);
  console.log("---");

  // Step 3: Deploy FixrFeeSplitter
  console.log("Step 3: Deploying FixrFeeSplitter...");
  const FixrFeeSplitter = await hre.ethers.getContractFactory("FixrFeeSplitter");
  const fixrFeeSplitter = await FixrFeeSplitter.deploy(
    stakingAddress,
    TREASURY_ADDRESS,
    deployer.address
  );
  await fixrFeeSplitter.waitForDeployment();
  const feeSplitterAddress = await fixrFeeSplitter.getAddress();
  console.log("FixrFeeSplitter deployed to:", feeSplitterAddress);
  console.log("---");

  // Summary
  console.log("=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("Contracts:");
  if (USE_DUMMY_TOKEN) {
    console.log("  DummyToken:", fixrTokenAddress);
  }
  console.log("  FixrStaking:", stakingAddress);
  console.log("  FixrFeeSplitter:", feeSplitterAddress);
  console.log("");
  console.log("Configuration:");
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  WETH:", WETH_BASE);
  console.log("  Stakers Share: 70%");
  console.log("  Treasury Share: 30%");
  console.log("");
  console.log("Lock Tiers:");
  console.log("  Tier 0: 7 days lock, 1.0x multiplier");
  console.log("  Tier 1: 30 days lock, 1.25x multiplier");
  console.log("  Tier 2: 90 days lock, 1.5x multiplier");
  console.log("  Tier 3: 180 days lock, 2.0x multiplier");
  console.log("");
  console.log("=== NEXT STEPS ===");
  console.log("1. Verify contracts on BaseScan:");
  if (USE_DUMMY_TOKEN) {
    console.log(`   npx hardhat verify --network base ${fixrTokenAddress} "${deployer.address}"`);
  }
  console.log(`   npx hardhat verify --network base ${stakingAddress} "${fixrTokenAddress}" "${deployer.address}"`);
  console.log(`   npx hardhat verify --network base ${feeSplitterAddress} "${stakingAddress}" "${TREASURY_ADDRESS}" "${deployer.address}"`);
  console.log("");
  console.log("2. When launching real FIXR token via Clanker:");
  console.log(`   Set fee recipient to: ${feeSplitterAddress}`);
  console.log("");
  console.log("3. To test staking (with dummy token):");
  console.log("   - Approve staking contract to spend tokens");
  console.log("   - Call stake(amount, tierIndex) on staking contract");
  console.log("");
  console.log("4. To distribute fees:");
  console.log("   - Send ETH or WETH to FeeSplitter address");
  console.log("   - Call distributeAll() as owner");

  // Save deployment addresses to file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      dummyToken: USE_DUMMY_TOKEN ? fixrTokenAddress : null,
      fixrStaking: stakingAddress,
      fixrFeeSplitter: feeSplitterAddress,
    },
    config: {
      treasury: TREASURY_ADDRESS,
      weth: WETH_BASE,
      stakersShareBps: 7000,
      treasuryShareBps: 3000,
    },
  };

  fs.writeFileSync(
    `./deployments-${hre.network.name}-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployments file.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
