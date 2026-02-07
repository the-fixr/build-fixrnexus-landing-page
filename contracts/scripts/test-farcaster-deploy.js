const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  console.log("Testing FarcasterOracle deployment...");

  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);

  // Load compiled contract
  const artifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../artifacts/contracts/FarcasterOracle.sol/FarcasterOracle.json'), 'utf8')
  );

  const REGISTRY = "0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64";
  const validators = [
    "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
    "0xdd97618068a90c54F128ffFdfc49aa7847A52316",
    "0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C",
    "0xeC4119bCF8378d683dc223056e07c23E5998b8a6",
    "0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c"
  ];

  console.log("\nDeploying FarcasterOracle directly...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  try {
    const contract = await factory.deploy(
      "TEST-DEGEN",          // name
      "TEST-DEGEN",          // symbol
      "DEGEN",               // targetToken
      66,                    // consensusThreshold
      3600,                  // updateFrequency
      REGISTRY,              // registry
      validators,            // validators
      {
        gasLimit: 3000000
      }
    );

    console.log("Tx hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("✅ FarcasterOracle deployed:", address);
  } catch (error) {
    console.error("Deployment failed:");
    console.error(error.message);

    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
