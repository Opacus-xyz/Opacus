import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId;
  console.log(`\n🚀 Deploying Opacus Contract Suite to chainId ${network}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${(await ethers.provider.getBalance(deployer.address))}`);

  // 1. Deploy DACRegistry
  const DACRegistry = await ethers.getContractFactory("DACRegistry");
  const dacRegistry = await DACRegistry.deploy();
  await dacRegistry.waitForDeployment();
  console.log(`✅ DACRegistry: ${dacRegistry.target}`);

  // 2. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  console.log(`✅ AgentRegistry: ${agentRegistry.target}`);

  // 3. Deploy DataStream
  const DataStream = await ethers.getContractFactory("DataStream");
  const dataStream = await DataStream.deploy();
  await dataStream.waitForDeployment();
  console.log(`✅ DataStream: ${dataStream.target}`);

  // 4. Deploy MsgEscrow (requires ERC20 token address)
  const paymentToken = process.env.PAYMENT_TOKEN || ethers.ZeroAddress; // Replace with actual 0G token wrapper
  const MsgEscrow = await ethers.getContractFactory("MsgEscrow");
  const msgEscrow = await MsgEscrow.deploy(paymentToken);
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
    paymentToken,
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
