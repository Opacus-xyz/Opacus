import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId;
  console.log(`\n🚀 Deploying Opacus Contract Suite to chainId ${network}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${(await ethers.provider.getBalance(deployer.address))}`);

  // Protocol treasury address (deployer address or custom treasury)
  const protocolTreasury = process.env.PROTOCOL_TREASURY || deployer.address;
  console.log(`🏦 Protocol Treasury: ${protocolTreasury}`);

  // 1. Deploy DACRegistry with treasury
  const DACRegistry = await ethers.getContractFactory("DACRegistry");
  const dacRegistry = await DACRegistry.deploy(protocolTreasury);
  await dacRegistry.waitForDeployment();
  console.log(`✅ DACRegistry: ${dacRegistry.target}`);

  // 2. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  console.log(`✅ AgentRegistry: ${agentRegistry.target}`);

  // 3. Deploy DataStream with treasury
  const DataStream = await ethers.getContractFactory("DataStream");
  const dataStream = await DataStream.deploy(protocolTreasury);
  await dataStream.waitForDeployment();
  console.log(`✅ DataStream: ${dataStream.target}`);

  // 4. Deploy MsgEscrow with payment token and treasury
  const paymentToken = process.env.PAYMENT_TOKEN || ethers.ZeroAddress; // Replace with actual 0G token wrapper
  const MsgEscrow = await ethers.getContractFactory("MsgEscrow");
  const msgEscrow = await MsgEscrow.deploy(paymentToken, protocolTreasury);
  await msgEscrow.waitForDeployment();
  console.log(`✅ MsgEscrow: ${msgEscrow.target}`);

  // 5. Deploy OpacusCore
  const OpacusCore = await ethers.getContractFactory("OpacusCore");
  const opacusCore = await OpacusCore.deploy();
  await opacusCore.waitForDeployment();
  console.log(`✅ OpacusCore: ${opacusCore.target}`);

  // 6. Initialize core
  const tx = await opacusCore.initialize(
    dacRegistry.target,
    agentRegistry.target,
    dataStream.target,
    msgEscrow.target
  );
  await tx.wait();
  console.log("🔗 Core initialized");

  // Write addresses
  const output = {
    network: Number(network),
    timestamp: Date.now(),
    deployer: deployer.address,
    protocolTreasury,
    paymentToken,
    protocolFee: "2%",
    contracts: {
      DACRegistry: dacRegistry.target,
      AgentRegistry: agentRegistry.target,
      DataStream: dataStream.target,
      MsgEscrow: msgEscrow.target,
      OpacusCore: opacusCore.target
    }
  };

  const outPath = path.join(__dirname, "../addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n📄 Addresses saved to addresses.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
