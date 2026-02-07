const hre = require("hardhat");

async function main() {
  const oracleAddress = "0x793Bd341405A5298707C175Bf62B7D171aef02c7";
  
  console.log("Checking Oracle at:", oracleAddress);
  console.log("");
  
  // Check if contract exists
  const code = await hre.ethers.provider.getCode(oracleAddress);
  console.log("Contract exists:", code !== "0x" ? "✅ YES" : "❌ NO");
  console.log("Code size:", code.length, "bytes");
  console.log("");
  
  if (code === "0x") {
    console.log("No contract at this address!");
    return;
  }
  
  // Try to read oracle data
  const oracle = await hre.ethers.getContractAt("PriceOracle", oracleAddress);
  
  try {
    const name = await oracle.name();
    console.log("Oracle Name:", name);
  } catch (e) {
    console.log("Could not read name:", e.message);
  }
  
  try {
    const symbol = await oracle.symbol();
    console.log("Oracle Symbol:", symbol);
  } catch (e) {
    console.log("Could not read symbol:", e.message);
  }
  
  try {
    const threshold = await oracle.consensusThreshold();
    console.log("Consensus Threshold:", threshold.toString(), "%");
  } catch (e) {
    console.log("Could not read threshold:", e.message);
  }
  
  try {
    const frequency = await oracle.updateFrequency();
    console.log("Update Frequency:", frequency.toString(), "seconds (", Number(frequency) / 60, "minutes)");
  } catch (e) {
    console.log("Could not read frequency:", e.message);
  }
  
  try {
    const registry = await oracle.registry();
    console.log("Registry:", registry);
  } catch (e) {
    console.log("Could not read registry:", e.message);
  }
  
  console.log("");
  console.log("✅ Oracle deployed successfully!");
  console.log("");
  console.log("View on BaseScan:");
  console.log("https://basescan.org/address/" + oracleAddress);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
