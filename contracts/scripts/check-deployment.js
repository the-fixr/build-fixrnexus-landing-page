const hre = require("hardhat");

async function main() {
  const txHash = "0xb5b116801ffa5379c173b6804d04916837a7ec9826797385a1c8a666009bb3b2";
  
  console.log("Fetching transaction:", txHash);
  console.log("");
  
  const tx = await hre.ethers.provider.getTransaction(txHash);
  if (!tx) {
    console.log("Transaction not found!");
    return;
  }
  
  console.log("From:", tx.from);
  console.log("To (Factory):", tx.to);
  console.log("Block:", tx.blockNumber);
  
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  
  if (!receipt) {
    console.log("Receipt not found - transaction may be pending");
    return;
  }
  
  console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("");
  
  // Parse logs to find OracleDeployed event
  const factoryAbi = [
    'event OracleDeployed(address indexed oracleAddress, address indexed creator, string name)'
  ];
  
  const iface = new hre.ethers.Interface(factoryAbi);
  
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'OracleDeployed') {
        console.log("🎉 ORACLE DEPLOYED!");
        console.log("Oracle Address:", parsed.args.oracleAddress);
        console.log("Creator:", parsed.args.creator);
        console.log("Name:", parsed.args.name);
        console.log("");
        
        // Verify oracle contract exists
        const code = await hre.ethers.provider.getCode(parsed.args.oracleAddress);
        console.log("Contract deployed:", code !== "0x" ? "✅ YES" : "❌ NO");
        console.log("Contract code size:", code.length, "bytes");
      }
    } catch (e) {
      // Not the event we're looking for
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
