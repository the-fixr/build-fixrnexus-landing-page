const hre = require("hardhat");

const REGISTRY_ADDRESS = "0x9262cDe71f1271Ea542545C7A379E112f904439b";

const validators = [
  {
    index: 2,
    address: "0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C",
    endpoint: "https://feeds-validator-3.see21289.workers.dev"
  }
];

async function main() {
  console.log("Registering validators in OracleRegistry...");
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const registry = await hre.ethers.getContractAt("OracleRegistry", REGISTRY_ADDRESS);

  console.log("Registry address:", REGISTRY_ADDRESS);
  console.log("");

  for (const validator of validators) {
    console.log(`Registering Validator ${validator.index + 1}:`);
    console.log(`  Address: ${validator.address}`);
    console.log(`  Endpoint: ${validator.endpoint}`);

    try {
      const tx = await registry.addValidator(
        validator.index,
        validator.address,
        validator.endpoint,
        {
          maxPriorityFeePerGas: hre.ethers.parseUnits("0.05", "gwei"),
          maxFeePerGas: hre.ethers.parseUnits("2", "gwei")
        }
      );

      console.log(`  Transaction: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ Registered successfully`);
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    console.log("");
  }

  console.log("================================");
  console.log("Validator Registration Complete!");
  console.log("================================");
  console.log("");
  console.log("Next step: Run setup-factory script");
  console.log("  npm run setup:factory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
