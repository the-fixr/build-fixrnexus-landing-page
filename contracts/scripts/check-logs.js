const hre = require("hardhat");

async function main() {
  const txHash = "0xb5b116801ffa5379c173b6804d04916837a7ec9826797385a1c8a666009bb3b2";
  
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  
  console.log("Total logs:", receipt.logs.length);
  console.log("");
  
  // Check each log
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`Log ${i}:`);
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics);
    console.log("  Data:", log.data);
    console.log("");
    
    // If this looks like it could be from a contract deployment (address is new contract)
    if (log.topics.length > 0) {
      // First topic is event signature
      console.log("  Event signature:", log.topics[0]);
    }
  }
  
  // Try to find contract creation in the logs
  // The oracle address should be in one of the logs
  console.log("\nAll unique addresses in logs:");
  const addresses = new Set();
  receipt.logs.forEach(log => addresses.add(log.address));
  addresses.forEach(addr => console.log("  -", addr));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
