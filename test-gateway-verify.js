// Test gateway's verifySignature function directly
const secp = require('@noble/secp256k1');
const { sha256 } = require('@noble/hashes/sha2.js');
const config = require('./test-config.json');

// Recreate gateway's verifySignature function
async function verifySignature(message, signature, publicKey) {
  try {
    const hash = sha256(message);
    const sig = Buffer.from(signature, 'hex');
    const pubKey = Buffer.from(publicKey, 'hex');
    console.log('Verifying:');
    console.log('  Hash:', Buffer.from(hash).toString('hex').substring(0, 16) + '...');
    console.log('  Sig:', sig.toString('hex').substring(0, 16) + '...');
    console.log('  PubKey:', pubKey.toString('hex').substring(0, 16) + '...');
    const result = await secp.verify(sig, hash, pubKey);
    console.log('  Result:', result);
    return result;
  } catch (error) {
    console.log('  Error:', error.message);
    return false;
  }
}

async function test() {
  // Use exact values
  const nonce = 'f17d0e9d97f6ef909572573946ae99ab4c4d27b70d37d1c51de9db43e42d3346';
  const clientId = 'AgentA';
  const timestamp = 1763754631719;
  const agent = config.agents[0];
  
  // Create message
  const nonceBytes = Buffer.from(nonce, 'hex');
  const clientIdBytes = Buffer.from(clientId, 'utf8');
  const timestampBytes = Buffer.alloc(8);
  timestampBytes.writeBigUInt64BE(BigInt(timestamp));
  const message = Buffer.concat([nonceBytes, clientIdBytes, timestampBytes]);
  
  // Sign
  const messageHash = sha256(message);
  const privateKeyBytes = Buffer.from(agent.privateKey, 'hex');
  const signature = await secp.signAsync(messageHash, privateKeyBytes);
  const signatureBytes = signature.toCompactRawBytes ? signature.toCompactRawBytes() : signature;
  const signatureHex = Buffer.from(signatureBytes).toString('hex');
  
  console.log('\n🧪 Testing Gateway\'s verifySignature Function\n');
  const valid = await verifySignature(message, signatureHex, agent.publicKey);
  console.log('\n✅ Final Result:', valid ? 'PASS' : 'FAIL');
}

test().catch(console.error);
