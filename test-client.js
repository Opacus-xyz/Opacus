#!/usr/bin/env node
/**
 * Test Client - Connect to Gateway and Test Communication
 */

const config = require('./test-config.json');

console.log('🧪 Opacus Test Client\n');
console.log('Gateway:', config.gateway.http);
console.log('Agent A:', config.agents[0].address);
console.log('\n📡 Testing connection...\n');

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
        console.log('\n✨ Gateway is running and accessible!');
    })
    .catch(err => {
        console.error('❌ Connection failed:', err.message);
        console.log('\n💡 Make sure gateway is running: ./start-gateway.sh');
    });
