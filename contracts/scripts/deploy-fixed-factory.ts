import { ethers } from "hardhat";

async function main() {
  console.log("Deploying fixed OracleFactory with patched FarcasterOracle...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const REGISTRY_ADDRESS = "0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64";

  // Deploy new factory
  const OracleFactory = await ethers.getContractFactory("OracleFactory");
  const factory = await OracleFactory.deploy(REGISTRY_ADDRESS);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ New OracleFactory deployed to:", factoryAddress);

  // Set validators
  const validators = [
    "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
    "0xdd97618068a90c54F128ffFdfc49aa7847A52316",
    "0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C",
    "0xeC4119bCF8378d683dc223056e07c23E5998b8a6",
    "0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c"
  ];

  console.log("Setting validators...");
  const tx = await factory.setValidators(validators);
  await tx.wait();
  console.log("✅ Validators configured");

  console.log("\n📋 Summary:");
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Factory:", factoryAddress);
  console.log("Validators:", validators.length);

  console.log("\n🔧 Update your .env.local with:");
  console.log(`NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS=${factoryAddress}`);

  console.log("\n📝 Next steps:");
  console.log("1. Update .env.local with new factory address");
  console.log("2. Deploy new DEGEN oracle using the UI or script");
  console.log("3. Validators will automatically detect and process the new oracle");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
