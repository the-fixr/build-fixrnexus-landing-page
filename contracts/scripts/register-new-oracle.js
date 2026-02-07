const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  console.log("Registering new fixed FarcasterOracle in registry...");

  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  const REGISTRY_ADDRESS = "0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64";
  const ORACLE_ADDRESS = "0x5B5B1548824CC26B225F2da9e792daF5d9eAdedc";

  const registryAbi = [
    "function registerOracle(address _oracleAddress, string memory _name, string memory _oracleType, uint256 _updateFrequency, uint8 _consensusThreshold) external"
  ];

  const registry = new ethers.Contract(REGISTRY_ADDRESS, registryAbi, wallet);

  console.log("\nRegistering oracle:");
  console.log("- Address:", ORACLE_ADDRESS);
  console.log("- Name: TEST-DEGEN");
  console.log("- Type: farcaster");
  console.log("- Frequency: 3600 seconds");
  console.log("- Consensus: 66%");

  const tx = await registry.registerOracle(
    ORACLE_ADDRESS,
    "TEST-DEGEN",
    "farcaster",
    3600,
    66,
    { gasLimit: 200000 }
  );

  console.log("\nTx hash:", tx.hash);
  console.log("Waiting for confirmation...");

  await tx.wait();
  console.log("✅ Oracle registered!");

  console.log("\n📋 Summary:");
  console.log("Oracle address:", ORACLE_ADDRESS);
  console.log("Target token: DEGEN");
  console.log("Status: Ready for validator submissions");

  console.log("\n🔧 Test it:");
  console.log(`curl http://localhost:3000/api/v1/farcaster/${ORACLE_ADDRESS} | jq`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
