const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration - UPDATE THESE AFTER DEPLOYMENT
const DEPLOYMENT = {
  dummyToken: "", // Set after deployment
  fixrStaking: "", // Set after deployment
  fixrFeeSplitter: "", // Set after deployment
  deployer: "", // Set to deployer address
  treasury: "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
};

async function main() {
  // Try to load from latest deployment file
  const deploymentsDir = path.join(__dirname, "..");
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith("deployments-base-"))
    .sort()
    .reverse();

  if (files.length > 0) {
    const latestDeployment = JSON.parse(
      fs.readFileSync(path.join(deploymentsDir, files[0]), "utf8")
    );
    console.log("Using deployment file:", files[0]);
    DEPLOYMENT.dummyToken = latestDeployment.contracts.dummyToken;
    DEPLOYMENT.fixrStaking = latestDeployment.contracts.fixrStaking;
    DEPLOYMENT.fixrFeeSplitter = latestDeployment.contracts.fixrFeeSplitter;
    DEPLOYMENT.deployer = latestDeployment.deployer;
  } else {
    console.log("No deployment file found. Please update DEPLOYMENT object manually.");
    process.exit(1);
  }

  console.log("Verifying contracts...");
  console.log("---");

  // Verify DummyToken
  if (DEPLOYMENT.dummyToken) {
    console.log("Verifying DummyToken...");
    try {
      await hre.run("verify:verify", {
        address: DEPLOYMENT.dummyToken,
        constructorArguments: [DEPLOYMENT.deployer],
      });
      console.log("DummyToken verified!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("DummyToken already verified.");
      } else {
        console.error("DummyToken verification failed:", error.message);
      }
    }
    console.log("---");
  }

  // Verify FixrStaking
  console.log("Verifying FixrStaking...");
  try {
    const stakingToken = DEPLOYMENT.dummyToken || process.env.FIXR_TOKEN_ADDRESS;
    await hre.run("verify:verify", {
      address: DEPLOYMENT.fixrStaking,
      constructorArguments: [stakingToken, DEPLOYMENT.deployer],
    });
    console.log("FixrStaking verified!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("FixrStaking already verified.");
    } else {
      console.error("FixrStaking verification failed:", error.message);
    }
  }
  console.log("---");

  // Verify FixrFeeSplitter
  console.log("Verifying FixrFeeSplitter...");
  try {
    await hre.run("verify:verify", {
      address: DEPLOYMENT.fixrFeeSplitter,
      constructorArguments: [
        DEPLOYMENT.fixrStaking,
        DEPLOYMENT.treasury,
        DEPLOYMENT.deployer,
      ],
    });
    console.log("FixrFeeSplitter verified!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("FixrFeeSplitter already verified.");
    } else {
      console.error("FixrFeeSplitter verification failed:", error.message);
    }
  }

  console.log("---");
  console.log("Verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
