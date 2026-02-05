const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying BuilderID contract with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Configuration
  // The baseTokenURI points to the Fixr API which generates metadata for each FID
  const baseTokenURI = "https://fixr-agent.see21289.workers.dev/api/builder-id/metadata/";

  console.log("\nDeployment Parameters:");
  console.log("- Base Token URI:", baseTokenURI);

  // Deploy the contract
  const BuilderID = await ethers.getContractFactory("BuilderID");
  const builderID = await BuilderID.deploy(baseTokenURI);

  await builderID.waitForDeployment();

  const contractAddress = await builderID.getAddress();

  console.log("\n========================================");
  console.log("BuilderID deployed successfully!");
  console.log("========================================");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("========================================");

  console.log("\nNext steps:");
  console.log("1. Update BUILDER_ID_CONTRACT in workers/src/lib/builderID.ts:");
  console.log(`   export const BUILDER_ID_CONTRACT = '${contractAddress}';`);
  console.log("\n2. Verify the contract on Basescan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress} "${baseTokenURI}" --config hardhat.config.cjs`);

  return { contractAddress, baseTokenURI };
}

main()
  .then((result) => {
    console.log("\nDeployment complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
