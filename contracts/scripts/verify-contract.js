const hre = require("hardhat");

async function main() {
  const address = "0x9262cDe71f1271Ea542545C7A379E112f904439b";
  
  console.log("Checking contract at:", address);
  
  const code = await hre.ethers.provider.getCode(address);
  console.log("Contract code length:", code.length);
  console.log("Has code:", code !== "0x");
  
  if (code === "0x") {
    console.log("\n⚠️  NO CONTRACT CODE AT THIS ADDRESS!");
  } else {
    console.log("\n✅ Contract exists");
    console.log("Code preview:", code.substring(0, 100) + "...");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
