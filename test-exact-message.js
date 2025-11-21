const secp = require('@noble/secp256k1');
const { sha256 } = require('@noble/hashes/sha2.js');
const config = require('./test-config.json');

async function testWithGatewayMessage() {
  // Use exact values from gateway log
  const nonce = 'f17d0e9d97f6ef909572573946ae99ab4c4d27b70d37d1c51de9db43e42d3346';
  const clientId = 'AgentA';
  const timestamp = 1763754631719;
  
  // Agent A keys
  const agent = config.agents[0];
  
  console.log('Testing with exact gateway values:');
  console.log('Nonce:', nonce.substring(0, 16) + '...');
  console.log('ClientID:', clientId);
  console.log('Timestamp:', timestamp);
  console.log('Private Key:', agent.privateKey.substring(0, 16) + '...');
  console.log('Public Key:', agent.publicKey.substring(0, 16) + '...');
  
  // Recreate message exactly like test does
  const nonceBytes = Buffer.from(nonce, 'hex');
  const clientIdBytes = Buffer.from(clientId, 'utf8');
  const timestampBytes = Buffer.alloc(8);
  timestampBytes.writeBigUInt64BE(BigInt(timestamp));
  
  const message = Buffer.concat([nonceBytes, clientIdBytes, timestampBytes]);
  console.log('\nMessage (hex):', message.toString('hex').substring(0, 48) + '...');
  console.log('Message length:', message.length, 'bytes');
  
  // Hash and sign
  const messageHash = sha256(message);
  console.log('Message Hash:', Buffer.from(messageHash).toString('hex').substring(0, 16) + '...');
  
  const privateKeyBytes = Buffer.from(agent.privateKey, 'hex');
  const signature = await secp.signAsync(messageHash, privateKeyBytes);
  const signatureBytes = signature.toCompactRawBytes ? signature.toCompactRawBytes() : signature;
  console.log('Signature:', Buffer.from(signatureBytes).toString('hex').substring(0, 16) + '...');
  
  // Verify with our own public key
  const publicKeyBytes = Buffer.from(agent.publicKey, 'hex');
  const valid = await secp.verify(signatureBytes, messageHash, publicKeyBytes);
  console.log('Self-verification:', valid ? '✅ PASS' : '❌ FAIL');
}

testWithGatewayMessage().catch(console.error);
