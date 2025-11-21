#!/usr/bin/env node

/**
 * Opacus Test Environment Setup
 * Sets up gateway, generates test keys, and provides connection details
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const secp = require('@noble/secp256k1');

console.log('🚀 Opacus Test Environment Setup\n');
console.log('='.repeat(60));

// Generate test keys using secp256k1 (same as gateway)
async function generateTestKeys(name) {
    const privateKey = secp.utils.randomPrivateKey ? secp.utils.randomPrivateKey() : crypto.randomBytes(32);
    const publicKey = await secp.getPublicKey(privateKey);
    
    // Derive Ethereum-style address from public key
    const hash = crypto.createHash('sha256').update(Buffer.from(publicKey)).digest();
    const address = '0x' + hash.toString('hex').substring(24); // Last 20 bytes
    
    return {
        name,
        privateKey: Buffer.from(privateKey).toString('hex'),
        publicKey: Buffer.from(publicKey).toString('hex'),
        address
    };
}

async function setup() {
    console.log('\n1️⃣  Generating Test Agent Keys (secp256k1)...\n');

    const agents = await Promise.all([
        generateTestKeys('Agent A (Data Processor)'),
        generateTestKeys('Agent B (AI Assistant)'),
        generateTestKeys('Agent C (Market Analyzer)')
    ]);

    agents.forEach(agent => {
        console.log(`✅ ${agent.name}`);
        console.log(`   Private Key: ${agent.privateKey.substring(0, 16)}...`);
        console.log(`   Public Key:  ${agent.publicKey.substring(0, 16)}...`);
        console.log(`   Address:     ${agent.address}`);
        console.log('');
    });

    // Generate gateway keys
    console.log('2️⃣  Generating Gateway Keys (secp256k1)...\n');
    const gateway = await generateTestKeys('Gateway Server');
    console.log(`✅ Gateway Private Key: ${gateway.privateKey.substring(0, 16)}...`);
    console.log(`✅ Gateway Public Key:  ${gateway.publicKey.substring(0, 16)}...`);
    console.log(`✅ Gateway Address:     ${gateway.address}\n`);

    // Create .env file
    console.log('3️⃣  Creating Environment File...\n');

    const envContent = `# Opacus Test Environment - Auto Generated
# Generated: ${new Date().toISOString()}
# WARNING: FOR TESTING ONLY - DO NOT USE IN PRODUCTION

# Server Configuration
PORT=8080
NODE_ENV=development
LOG_LEVEL=debug

# Gateway Keys
GATEWAY_PRIVATE_KEY=${gateway.privateKey}
GATEWAY_PUBLIC_KEY=${gateway.publicKey}
GATEWAY_ADDRESS=${gateway.address}

# Test Agent Keys
TEST_AGENT_A_PRIVATE=${agents[0].privateKey}
TEST_AGENT_A_PUBLIC=${agents[0].publicKey}
TEST_AGENT_A_ADDRESS=${agents[0].address}

TEST_AGENT_B_PRIVATE=${agents[1].privateKey}
TEST_AGENT_B_PUBLIC=${agents[1].publicKey}
TEST_AGENT_B_ADDRESS=${agents[1].address}

TEST_AGENT_C_PRIVATE=${agents[2].privateKey}
TEST_AGENT_C_PUBLIC=${agents[2].publicKey}
TEST_AGENT_C_ADDRESS=${agents[2].address}

# 0G Chain Configuration (Testnet)
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
OG_CHAIN_WEBSOCKET=wss://evmrpc-testnet.0g.ai
OG_CHAIN_EXPLORER=https://chainscan-newton.0g.ai

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Session Configuration
NONCE_EXPIRY_SECONDS=30
SESSION_EXPIRY_SECONDS=3600

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_PAYLOAD=10485760
`;

    const envPath = path.join(__dirname, 'gateway', '.env');
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Created: ${envPath}\n`);

    // Create test configuration file
    console.log('4️⃣  Creating Test Configuration...\n');

    const testConfig = {
        gateway: {
            http: 'http://localhost:8080',
            ws: 'ws://localhost:8080',
            privateKey: gateway.privateKey,
            publicKey: gateway.publicKey,
            address: gateway.address
        },
        agents: agents.map(a => ({
            name: a.name,
            privateKey: a.privateKey,
            publicKey: a.publicKey,
            address: a.address
        })),
        chain: {
            name: '0G Chain Testnet',
            rpc: 'https://evmrpc-testnet.0g.ai',
            chainId: 16602,
            explorer: 'https://chainscan-newton.0g.ai'
        },
        endpoints: {
            getNonce: 'http://localhost:8080/nonce',
            authenticate: 'http://localhost:8080/auth',
            sendMessage: 'ws://localhost:8080',
            health: 'http://localhost:8080/health'
        }
    };

    const configPath = path.join(__dirname, 'test-config.json');
    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
    console.log(`✅ Created: ${configPath}\n`);

    // Create quick start script
    console.log('5️⃣  Creating Quick Start Scripts...\n');

    const startGatewayScript = `#!/bin/bash
# Start Opacus Gateway

echo "🚀 Starting Opacus Gateway..."
cd gateway

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "🔨 Building gateway..."
    npm run build
fi

echo "✅ Starting server on http://localhost:8080"
npm start
`;

    const startScriptPath = path.join(__dirname, 'start-gateway.sh');
    fs.writeFileSync(startScriptPath, startGatewayScript);
    fs.chmodSync(startScriptPath, '755');
    console.log(`✅ Created: ${startScriptPath}\n`);

    // Create test client script
    const testClientScript = `#!/usr/bin/env node
/**
 * Test Client - Connect to Gateway and Test Communication
 */

const config = require('./test-config.json');

console.log('🧪 Opacus Test Client\\n');
console.log('Gateway:', config.gateway.http);
console.log('Agent A:', config.agents[0].address);
console.log('\\n📡 Testing connection...\\n');

// Test 1: Health Check
fetch(config.endpoints.health)
    .then(r => r.json())
    .then(data => {
        console.log('✅ Health Check:', data.status);
        
        // Test 2: Get Nonce
        return fetch(config.endpoints.getNonce + '?clientId=' + config.agents[0].address);
    })
    .then(r => r.json())
    .then(data => {
        console.log('✅ Nonce Received:', data.nonce?.substring(0, 16) + '...');
        console.log('\\n✨ Gateway is running and accessible!');
    })
    .catch(err => {
        console.error('❌ Connection failed:', err.message);
        console.log('\\n💡 Make sure gateway is running: ./start-gateway.sh');
    });
`;

    const testClientPath = path.join(__dirname, 'test-client.js');
    fs.writeFileSync(testClientPath, testClientScript);
    fs.chmodSync(testClientPath, '755');
    console.log(`✅ Created: ${testClientPath}\n`);

    // Print summary
    console.log('='.repeat(60));
    console.log('\n✅ TEST ENVIRONMENT READY!\n');
    console.log('📋 Next Steps:\n');
    console.log('1️⃣  Start Gateway:');
    console.log('   ./start-gateway.sh');
    console.log('   (or manually: cd gateway && npm install && npm start)\n');
    console.log('2️⃣  Test Connection:');
    console.log('   node test-client.js\n');
    console.log('3️⃣  Use SDK:');
    console.log('   import { OpacusClient } from "@brienteth/opacus-sdk";');
    console.log('   const config = require("./test-config.json");');
    console.log('   const client = new OpacusClient({');
    console.log('     privateKey: config.agents[0].privateKey,');
    console.log('     gatewayUrl: config.gateway.ws');
    console.log('   });\n');
    console.log('📄 Configuration Files:');
    console.log('   - gateway/.env          (Gateway environment)');
    console.log('   - test-config.json      (Test configuration)');
    console.log('   - start-gateway.sh      (Start script)');
    console.log('   - test-client.js        (Test client)\n');
    console.log('🔗 Endpoints:');
    console.log('   - HTTP:  http://localhost:8080');
    console.log('   - WS:    ws://localhost:8080');
    console.log('   - Chain: https://evmrpc-testnet.0g.ai\n');
    console.log('🔑 Test Keys saved in test-config.json');
    console.log('⚠️  WARNING: These are test keys only - DO NOT use in production!\n');
}

// Run setup
setup().catch(console.error);
