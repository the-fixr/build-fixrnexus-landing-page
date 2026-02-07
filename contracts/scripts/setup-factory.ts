const hre = require("hardhat");

const FACTORY_ADDRESS = "0xBe17f562BF4068fb429D7729D0EAa64cEBf3ed88";

const validatorAddresses = [
  "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
  "0xdd97618068a90c54F128ffFdfc49aa7847A52316",
  "0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C",
  "0xeC4119bCF8378d683dc223056e07c23E5998b8a6",
  "0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c"
];

async function main() {
  console.log("Setting validators in OracleFactory...");
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const factory = await hre.ethers.getContractAt("OracleFactory", FACTORY_ADDRESS);

  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("");
  console.log("Setting validators:");
  validatorAddresses.forEach((addr, i) => {
    console.log(`  ${i + 1}. ${addr}`);
  });
  console.log("");

  try {
    const tx = await factory.setValidators(validatorAddresses);
    console.log("Transaction:", tx.hash);
    console.log("Waiting for confirmation...");

    await tx.wait();

    console.log("✅ Validators set successfully!");
    console.log("");
    console.log("================================");
    console.log("SETUP COMPLETE!");
    console.log("================================");
    console.log("");
    console.log("Your oracle system is now ready!");
    console.log("");
    console.log("⚠️  IMPORTANT: Fund each validator with ~0.01 ETH on Base:");
    validatorAddresses.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
    console.log("");
    console.log("Then users can create oracles via the UI at:");
    console.log("  http://localhost:3000/create-oracle");
  } catch (error: any) {
    console.log("❌ Error:", error.message);

    if (error.message.includes("Ownable")) {
      console.log("");
      console.log("⚠️  Make sure you're using the deployer account");
      console.log("   Factory owner:", deployer.address);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
