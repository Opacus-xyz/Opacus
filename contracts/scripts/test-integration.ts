import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * Opacus Integration Test Suite
 * Tests the full workflow: DAC registration, agent registration,
 * channel creation, subscriptions, and usage accounting
 */
async function testIntegration() {
  console.log("═".repeat(60));
  console.log("Opacus Integration Test");
  console.log("═".repeat(60));

  const [owner, agent1, agent2, subscriber] = await ethers.getSigners();
  console.log(`\n👤 Test Accounts:`);
  console.log(`   Owner:      ${owner.address}`);
  console.log(`   Agent 1:    ${agent1.address}`);
  console.log(`   Agent 2:    ${agent2.address}`);
  console.log(`   Subscriber: ${subscriber.address}`);

  // Deploy contracts
  console.log("\n📦 Deploying Contracts...");
  
  const DACRegistry = await ethers.getContractFactory("DACRegistry");
  const dacRegistry = await DACRegistry.deploy();
  await dacRegistry.waitForDeployment();
  console.log(`   ✅ DACRegistry: ${await dacRegistry.getAddress()}`);
  
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  console.log(`   ✅ AgentRegistry: ${await agentRegistry.getAddress()}`);
  
  const DataStream = await ethers.getContractFactory("DataStream");
  const dataStream = await DataStream.deploy();
  await dataStream.waitForDeployment();
  console.log(`   ✅ DataStream: ${await dataStream.getAddress()}`);

  // Test 1: Register DAC
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 1: Register DAC");
  console.log("─".repeat(60));
  
  const dacTx = await dacRegistry.connect(owner).registerDAC(
    "ipfs://QmOpacusTestMetadata",
    { value: ethers.parseEther("0.01") }
  );
  const dacReceipt = await dacTx.wait();
  const dacEvent = dacReceipt?.logs.find(
    (log: any) => log.fragment?.name === "DACRegistered"
  );
  const dacId = dacEvent?.args?.[0];
  
  console.log(`   DAC ID: ${dacId}`);
  console.log(`   Stake: ${ethers.formatEther(ethers.parseEther("0.01"))} 0G`);
  expect(dacId).to.not.be.undefined;
  
  const dac = await dacRegistry.getDAC(dacId);
  expect(dac.owner).to.equal(owner.address);
  expect(dac.active).to.be.true;
  console.log(`   ✅ DAC registered and active`);

  // Test 2: Register Agents
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 2: Register Agents");
  console.log("─".repeat(60));
  
  const agent1EdPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent1-ed25519-pubkey"));
  const agent1XPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent1-x25519-pubkey"));
  
  const agent1Tx = await agentRegistry.connect(agent1).registerAgent(
    agent1EdPubHash,
    agent1XPubHash,
    "ipfs://agent1-metadata",
    { value: ethers.parseEther("0.001") }
  );
  const agent1Receipt = await agent1Tx.wait();
  const agent1Event = agent1Receipt?.logs.find(
    (log: any) => log.fragment?.name === "AgentRegistered"
  );
  const agent1Id = agent1Event?.args?.[0];
  console.log(`   Agent 1 ID: ${agent1Id}`);
  console.log(`   Agent 1 Address: ${agent1.address}`);

  const agent2EdPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent2-ed25519-pubkey"));
  const agent2XPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent2-x25519-pubkey"));
  
  const agent2Tx = await agentRegistry.connect(agent2).registerAgent(
    agent2EdPubHash,
    agent2XPubHash,
    "ipfs://agent2-metadata",
    { value: ethers.parseEther("0.001") }
  );
  const agent2Receipt = await agent2Tx.wait();
  const agent2Event = agent2Receipt?.logs.find(
    (log: any) => log.fragment?.name === "AgentRegistered"
  );
  const agent2Id = agent2Event?.args?.[0];
  console.log(`   Agent 2 ID: ${agent2Id}`);
  console.log(`   Agent 2 Address: ${agent2.address}`);
  console.log(`   ✅ Both agents registered`);

  // Test 3: Verify Agent Keys
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 3: Verify Agent Keys");
  console.log("─".repeat(60));
  
  const isValid1 = await agentRegistry.verifyAgent(agent1Id, agent1EdPubHash);
  const isValid2 = await agentRegistry.verifyAgent(agent2Id, agent2EdPubHash);
  
  console.log(`   Agent 1 verification: ${isValid1}`);
  console.log(`   Agent 2 verification: ${isValid2}`);
  expect(isValid1).to.be.true;
  expect(isValid2).to.be.true;
  console.log(`   ✅ Agent keys verified`);

  // Test 4: Create Data Channel
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 4: Create Data Channel");
  console.log("─".repeat(60));
  
  const pricePerByte = 1n; // 1 wei per byte
  const pricePerMessage = 1000n; // 1000 wei per message
  const subscriptionFee = ethers.parseEther("0.001");
  
  const channelTx = await dataStream.connect(owner).createChannel(
    dacId,
    pricePerByte,
    pricePerMessage,
    subscriptionFee
  );
  const channelReceipt = await channelTx.wait();
  const channelEvent = channelReceipt?.logs.find(
    (log: any) => log.fragment?.name === "ChannelCreated"
  );
  const channelId = channelEvent?.args?.[0];
  
  console.log(`   Channel ID: ${channelId}`);
  console.log(`   Price per Byte: ${pricePerByte} wei`);
  console.log(`   Price per Message: ${pricePerMessage} wei`);
  console.log(`   Subscription Fee: ${ethers.formatEther(subscriptionFee)} 0G`);
  
  const channel = await dataStream.getChannel(channelId);
  expect(channel.dacId).to.equal(dacId);
  expect(channel.active).to.be.true;
  console.log(`   ✅ Channel created and active`);

  // Test 5: Subscribe to Channel
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 5: Subscribe to Channel");
  console.log("─".repeat(60));
  
  const depositAmount = ethers.parseEther("0.01");
  await dataStream.connect(subscriber).subscribe(channelId, {
    value: depositAmount
  });
  
  const subscription = await dataStream.getSubscription(channelId, subscriber.address);
  console.log(`   Subscriber: ${subscriber.address}`);
  console.log(`   Deposited: ${ethers.formatEther(subscription.deposited)} 0G`);
  console.log(`   Active: ${subscription.active}`);
  expect(subscription.active).to.be.true;
  console.log(`   ✅ Subscription active`);

  // Test 6: Record Usage
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 6: Record Usage");
  console.log("─".repeat(60));
  
  const bytesConsumed = 1000n;
  const messagesConsumed = 5n;
  
  await dataStream.connect(owner).recordUsage(
    channelId,
    subscriber.address,
    bytesConsumed,
    messagesConsumed
  );
  
  const updatedSub = await dataStream.getSubscription(channelId, subscriber.address);
  const expectedCost = (bytesConsumed * pricePerByte) + (messagesConsumed * pricePerMessage);
  
  console.log(`   Bytes consumed: ${updatedSub.bytesConsumed}`);
  console.log(`   Messages consumed: ${updatedSub.messagesConsumed}`);
  console.log(`   Cost incurred: ${updatedSub.used} wei`);
  console.log(`   Expected cost: ${expectedCost} wei`);
  
  expect(updatedSub.bytesConsumed).to.equal(bytesConsumed);
  expect(updatedSub.messagesConsumed).to.equal(messagesConsumed);
  expect(updatedSub.used).to.equal(expectedCost);
  console.log(`   ✅ Usage recorded correctly`);

  // Test 7: Settle Revenue
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 7: Settle Revenue");
  console.log("─".repeat(60));
  
  const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
  const settleTx = await dataStream.connect(owner).settle(channelId);
  const settleReceipt = await settleTx.wait();
  const gasUsed = settleReceipt!.gasUsed * settleTx.gasPrice!;
  const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
  
  const netReceived = ownerBalanceAfter - ownerBalanceBefore + gasUsed;
  
  console.log(`   Owner balance before: ${ethers.formatEther(ownerBalanceBefore)} 0G`);
  console.log(`   Owner balance after: ${ethers.formatEther(ownerBalanceAfter)} 0G`);
  console.log(`   Gas used: ${ethers.formatEther(gasUsed)} 0G`);
  console.log(`   Net received: ${ethers.formatEther(netReceived)} 0G`);
  console.log(`   ✅ Revenue settled`);

  // Test 8: Deactivate DAC
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 8: Deactivate DAC");
  console.log("─".repeat(60));
  
  await dacRegistry.connect(owner).deactivateDAC(dacId);
  const dacAfter = await dacRegistry.getDAC(dacId);
  
  console.log(`   DAC active status: ${dacAfter.active}`);
  expect(dacAfter.active).to.be.false;
  console.log(`   ✅ DAC deactivated`);

  // Test 9: Rotate Agent Keys
  console.log("\n" + "─".repeat(60));
  console.log("📝 Test 9: Rotate Agent Keys");
  console.log("─".repeat(60));
  
  const newEdPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent1-new-ed25519-key"));
  const newXPubHash = ethers.keccak256(ethers.toUtf8Bytes("agent1-new-x25519-key"));
  
  await agentRegistry.connect(agent1).rotateKeys(agent1Id, newEdPubHash, newXPubHash);
  const isNewKeyValid = await agentRegistry.verifyAgent(agent1Id, newEdPubHash);
  
  console.log(`   New key verified: ${isNewKeyValid}`);
  expect(isNewKeyValid).to.be.true;
  console.log(`   ✅ Keys rotated successfully`);

  // Final Summary
  console.log("\n" + "═".repeat(60));
  console.log("✅ ALL INTEGRATION TESTS PASSED");
  console.log("═".repeat(60));
  console.log("\n📊 Test Summary:");
  console.log(`   ✓ DAC Registration`);
  console.log(`   ✓ Agent Registration (2 agents)`);
  console.log(`   ✓ Agent Key Verification`);
  console.log(`   ✓ Data Channel Creation`);
  console.log(`   ✓ Channel Subscription`);
  console.log(`   ✓ Usage Recording`);
  console.log(`   ✓ Revenue Settlement`);
  console.log(`   ✓ DAC Deactivation`);
  console.log(`   ✓ Key Rotation`);
  console.log("═".repeat(60));
}

testIntegration().catch((error) => {
  console.error("\n❌ Integration test failed:");
  console.error(error);
  process.exitCode = 1;
});
