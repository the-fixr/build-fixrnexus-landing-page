const hre = require("hardhat");

const CLAWG_TOKEN = "0x06A127f0b53F83dD5d94E83D96B55a279705bB07";
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("---");

  console.log("Step 1: Deploying ClawgStaking...");
  const ClawgStaking = await hre.ethers.getContractFactory("ClawgStaking");
  const staking = await ClawgStaking.deploy(CLAWG_TOKEN, deployer.address);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("ClawgStaking:", stakingAddress);
  console.log("---");

  console.log("Step 2: Deploying ClawgFeeSplitter...");
  const ClawgFeeSplitter = await hre.ethers.getContractFactory("ClawgFeeSplitter");
  const splitter = await ClawgFeeSplitter.deploy(
    stakingAddress,
    TREASURY_ADDRESS,
    CLAWG_TOKEN,
    deployer.address
  );
  await splitter.waitForDeployment();
  const splitterAddress = await splitter.getAddress();
  console.log("ClawgFeeSplitter:", splitterAddress);
  console.log("---");

  console.log("=== DEPLOYMENT COMPLETE ===");
  console.log("Network:", hre.network.name);
  console.log("");
  console.log("ClawgStaking:", stakingAddress);
  console.log("ClawgFeeSplitter:", splitterAddress);
  console.log("CLAWG Token:", CLAWG_TOKEN);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("");
  console.log("Set fee recipient to:", splitterAddress);
  console.log("");
  console.log("Verify:");
  console.log(`npx hardhat verify --network base ${stakingAddress} "${CLAWG_TOKEN}" "${deployer.address}"`);
  console.log(`npx hardhat verify --network base ${splitterAddress} "${stakingAddress}" "${TREASURY_ADDRESS}" "${CLAWG_TOKEN}" "${deployer.address}"`);

  const fs = require("fs");
  fs.writeFileSync(
    `./deployments-clawg-${hre.network.name}-${Date.now()}.json`,
    JSON.stringify({
      network: hre.network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      clawgStaking: stakingAddress,
      clawgFeeSplitter: splitterAddress,
      clawgToken: CLAWG_TOKEN,
      treasury: TREASURY_ADDRESS,
    }, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
