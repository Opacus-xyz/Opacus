const secp = require('@noble/secp256k1');
const { sha256 } = require('@noble/hashes/sha2.js');
const { hmac } = require('@noble/hashes/hmac.js');
const config = require('./test-config.json');

// Configure secp256k1 with sha256 (required for some operations)
secp.etc.hmacSha256Sync = (key, ...msgs) => {
  return hmac(sha256, key, secp.etc.concatBytes(...msgs));
};
secp.etc.hmacSha256Async = (key, ...msgs) => {
  return Promise.resolve(secp.etc.hmacSha256Sync(key, ...msgs));
};
// IMPORTANT: Also set sha256 itself
secp.etc.sha256Sync = (...msgs) => sha256(secp.etc.concatBytes(...msgs));
secp.etc.sha256Async = (...msgs) => Promise.resolve(secp.etc.sha256Sync(...msgs));

async function testSignature() {
  const agent = config.agents[0];
  
  // Test message
  const message = Buffer.from('test message');
  const messageHash = sha256(message);
  
  console.log('Testing signature with:');
  console.log('Private Key:', agent.privateKey.substring(0, 16) + '...');
  console.log('Public Key:', agent.publicKey.substring(0, 16) + '...');
  console.log('Message:', message.toString());
  console.log('Message Hash:', Buffer.from(messageHash).toString('hex').substring(0, 16) + '...');
  
  // Sign
  const privateKeyBytes = Buffer.from(agent.privateKey, 'hex');
  const signature = await secp.signAsync(messageHash, privateKeyBytes);
  const signatureBytes = signature.toCompactRawBytes ? signature.toCompactRawBytes() : signature;
  console.log('\nSignature:', Buffer.from(signatureBytes).toString('hex').substring(0, 16) + '...');
  console.log('Signature length:', signatureBytes.length, 'bytes');
  
  // Verify - pass prehashed message
  const publicKeyBytes = Buffer.from(agent.publicKey, 'hex');
  const valid = await secp.verify(signatureBytes, messageHash, publicKeyBytes);
  console.log('\nVerification:', valid ? '✅ PASS' : '❌ FAIL');
  
  // Test with signature as hex string (like gateway does)
  const signatureHex = Buffer.from(signatureBytes).toString('hex');
  const sigFromHex = Buffer.from(signatureHex, 'hex');
  const valid2 = await secp.verify(sigFromHex, messageHash, publicKeyBytes);
  console.log('Verification (hex roundtrip):', valid2 ? '✅ PASS' : '❌ FAIL');
}

testSignature().catch(console.error);
