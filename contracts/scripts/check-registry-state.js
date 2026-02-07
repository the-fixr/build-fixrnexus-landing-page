const hre = require("hardhat");

const REGISTRY_ADDRESS = "0x9262cDe71f1271Ea542545C7A379E112f904439b";

async function main() {
  console.log("Checking OracleRegistry state at:", REGISTRY_ADDRESS);
  console.log("");

  const registry = await hre.ethers.getContractAt("OracleRegistry", REGISTRY_ADDRESS);

  // Check each validator slot
  console.log("Checking validator slots:");
  for (let i = 0; i < 5; i++) {
    try {
      const validator = await registry.validators(i);
      console.log(`\nSlot ${i}:`);
      console.log(`  Address: ${validator.validatorAddress}`);
      console.log(`  Endpoint: ${validator.endpoint}`);
      console.log(`  Active: ${validator.isActive}`);
      console.log(`  Validation Count: ${validator.validationCount.toString()}`);
    } catch (error) {
      console.log(`\nSlot ${i}: Error -`, error.message);
    }
  }

  // Check active validator count
  try {
    const activeCount = await registry.activeValidatorCount();
    console.log(`\nActive Validator Count: ${activeCount.toString()}`);
  } catch (error) {
    console.log("\nCould not get active count:", error.message);
  }

  // Try to get active validators (if function exists)
  try {
    const activeValidators = await registry.getActiveValidators();
    console.log(`\nActive Validators from getActiveValidators(): ${activeValidators.length}`);
    activeValidators.forEach((v, i) => {
      console.log(`${i + 1}. ${v.validatorAddress} (${v.isActive ? 'Active' : 'Inactive'})`);
    });
  } catch (error) {
    console.log("\ngetActiveValidators() not available or failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
