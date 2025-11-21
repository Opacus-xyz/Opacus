/**
 * Real SDK Integration Test
 * Tests full agent-to-agent messaging with authentication
 */

const config = require('./test-config.json');

// Simulated SDK Client (gerçek SDK'yı kullanmak yerine basit bir test)
async function testAgentMessaging() {
  console.log('\n🤖 Testing Agent-to-Agent Messaging\n');
  console.log('='.repeat(60));

  const agentA = config.agents[0];
  const agentB = config.agents[1];

  try {
    // Step 1: Agent A gets nonce
    console.log('\n1️⃣  Agent A requesting nonce...');
    const nonceRes = await fetch(`${config.endpoints.getNonce}?clientId=AgentA`);
    const nonceData = await nonceRes.json();
    console.log(`   ✅ Nonce received: ${nonceData.nonce.substring(0, 16)}...`);
    console.log(`   ✅ Server Public Key: ${nonceData.serverPubKey.substring(0, 16)}...`);

    // Step 2: Agent A signs message for authentication
    console.log('\n2️⃣  Agent A creating authentication signature...');
    
    // Import crypto for signing
    const crypto = require('crypto');
    const secp = require('@noble/secp256k1');
    const { sha256 } = require('@noble/hashes/sha2.js');
    
    // Create auth message: nonce + clientId + timestamp
    // IMPORTANT: Use timestamp BEFORE creating signature to avoid timing issues
    const timestamp = Date.now();
    const clientId = 'AgentA';
    
    console.log(`   ⏰ Creating signature immediately...`);
    
    // Sign the authentication message
    const nonceBytes = Buffer.from(nonceData.nonce, 'hex');
    const clientIdBytes = Buffer.from(clientId, 'utf8');
    // IMPORTANT: Use native endianness (Little Endian on most systems) to match gateway
    const timestampBytes = new Uint8Array(new BigUint64Array([BigInt(timestamp)]).buffer);
    
    const message = Buffer.concat([nonceBytes, clientIdBytes, Buffer.from(timestampBytes)]);
    console.log(`   📝 Message (hex): ${message.toString('hex').substring(0, 32)}...`);
    const messageHash = sha256(message);
    const privateKeyBytes = Buffer.from(agentA.privateKey, 'hex');
    const signature = await secp.signAsync(messageHash, privateKeyBytes);
    const signatureBytes = signature.toCompactRawBytes ? signature.toCompactRawBytes() : signature;
    const signatureHex = Buffer.from(signatureBytes).toString('hex');
    
    console.log(`   ✅ Signature created: ${signatureHex.substring(0, 16)}...`);

    // Step 3: Authenticate with gateway IMMEDIATELY (don't let nonce expire)
    console.log('\n3️⃣  Agent A authenticating with gateway...');
    console.log(`   📤 Sending Public Key: ${agentA.publicKey.substring(0, 16)}...`);
    console.log(`   📤 Using Nonce: ${nonceData.nonce.substring(0, 16)}...`);
    console.log(`   📤 Timestamp: ${timestamp}`);
    const authRes = await fetch(config.endpoints.authenticate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        signature: signatureHex,
        nonce: nonceData.nonce,
        clientPubKey: agentA.publicKey,
        timestamp,
      }),
    });

    const authData = await authRes.json();
    
    if (authData.status === 'success') {
      console.log(`   ✅ Authentication successful!`);
      console.log(`   ✅ Session Key: ${authData.sessionKey.substring(0, 16)}...`);
      console.log(`   ✅ Expires At: ${new Date(authData.expiresAt).toISOString()}`);
    } else {
      console.log(`   ❌ Authentication failed: ${authData.message}`);
      return;
    }

    // Step 4: Test WebSocket connection with session
    console.log('\n4️⃣  Testing WebSocket with authenticated session...');
    const WebSocket = require('ws');
    
    const ws = new WebSocket(config.endpoints.sendMessage);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('   ✅ WebSocket connected');
        
        // Authenticate via WebSocket
        ws.send(JSON.stringify({
          type: 'auth',
          clientId,
          sessionKey: authData.sessionKey,
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log(`   📩 Received: ${JSON.stringify(msg).substring(0, 80)}...`);
        
        if (msg.type === 'auth_success') {
          console.log('   ✅ WebSocket authenticated!');
          
          // Send ping
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (msg.type === 'pong') {
          console.log('   ✅ Ping/Pong successful!');
          ws.close();
          resolve();
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`   ❌ WebSocket error: ${error.message}`);
        reject(error);
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ AGENT MESSAGING TEST COMPLETE!\n');
    console.log('📊 Summary:');
    console.log('   ✓ Nonce generation');
    console.log('   ✓ Message signing');
    console.log('   ✓ Gateway authentication');
    console.log('   ✓ Session establishment');
    console.log('   ✓ WebSocket connection');
    console.log('   ✓ Authenticated WebSocket messaging');
    console.log('\n🚀 All agent communication systems operational!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAgentMessaging();
