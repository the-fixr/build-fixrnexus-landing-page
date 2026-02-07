const hre = require("hardhat");

async function main() {
  console.log("Deploying OracleRegistry...");

  const OracleRegistry = await hre.ethers.getContractFactory("OracleRegistry");
  const registry = await OracleRegistry.deploy();

  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("✅ OracleRegistry deployed to:", address);
  console.log("");
  console.log("Save this address! You'll need it for:");
  console.log("1. Deploying the Factory contract");
  console.log("2. Configuring Cloudflare Workers");
  console.log("3. Adding to .env.local");
  console.log("");
  console.log("Next step: Set REGISTRY_ADDRESS in .env and run deploy:factory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
