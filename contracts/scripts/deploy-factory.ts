const hre = require("hardhat");

async function main() {
  console.log("Deploying OracleFactory...");
  console.log("");

  // You'll need to paste your Registry address here
  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "";

  if (!REGISTRY_ADDRESS) {
    console.error("❌ Error: REGISTRY_ADDRESS not set");
    console.log("Add REGISTRY_ADDRESS=<your_registry_address> to .env");
    process.exit(1);
  }

  console.log("Using Registry at:", REGISTRY_ADDRESS);

  const OracleFactory = await hre.ethers.getContractFactory("OracleFactory");
  const factory = await OracleFactory.deploy(REGISTRY_ADDRESS);

  await factory.waitForDeployment();

  const address = await factory.getAddress();

  console.log("✅ OracleFactory deployed to:", address);
  console.log("");
  console.log("Save this address! You'll need it for:");
  console.log("1. Adding to .env.local as NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS");
  console.log("");
  console.log("Next steps:");
  console.log("1. Deploy 5 Cloudflare Workers");
  console.log("2. Register validators in Registry contract");
  console.log("3. Set validators in Factory contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
