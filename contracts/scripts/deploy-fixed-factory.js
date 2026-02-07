const hre = require("hardhat");

async function main() {
  console.log("Deploying fixed OracleFactory...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const REGISTRY = "0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64";

  const Factory = await hre.ethers.getContractFactory("OracleFactory");
  console.log("Deploying contract...");

  const factory = await Factory.deploy(REGISTRY);
  console.log("Waiting for deployment...");

  await factory.waitForDeployment();
  const address = await factory.getAddress();

  console.log("✅ Factory deployed:", address);

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
  console.log("✅ Done!");
  console.log("\nNew factory address:", address);
}

main().catch(console.error);
