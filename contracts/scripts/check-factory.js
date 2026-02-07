const hre = require("hardhat");

async function main() {
  const address = "0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6";
  
  console.log("Checking Factory at:", address);
  
  const code = await hre.ethers.provider.getCode(address);
  console.log("Has code:", code !== "0x");
  
  if (code === "0x") {
    console.log("⚠️  NO CONTRACT AT THIS ADDRESS!");
  } else {
    console.log("✅ Factory contract exists");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
