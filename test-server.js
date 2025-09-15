#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Replicate Minimax Image-01 MCP Server (New File-based API)...\n');

// Check if build directory exists
const buildPath = path.join(__dirname, 'build', 'index.js');

if (!fs.existsSync(buildPath)) {
  console.error('Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Check for REPLICATE_API_TOKEN
if (!process.env.REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN environment variable is required.');
  console.error('Please set your Replicate API token: export REPLICATE_API_TOKEN=r8_your_token_here');
  process.exit(1);
}

console.log('✓ Build directory found');
console.log('✓ REPLICATE_API_TOKEN is set');
console.log('\nStarting MCP server...\n');

// Start the server
const server = spawn('node', [buildPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

server.on('close', (code) => {
  console.log(`\nServer exited with code ${code}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

// Send a test message to initialize the server
setTimeout(() => {
  console.log('Sending initialization message...');
  
  const initMessage = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  }) + '\n';
  
  server.stdin.write(initMessage);
  
  // Send tools/list request
  setTimeout(() => {
    console.log('Requesting available tools...');
    
    const toolsMessage = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    }) + '\n';
    
    server.stdin.write(toolsMessage);
    
    // Close after a few seconds
    setTimeout(() => {
      console.log('\nTest completed. Closing server...');
      server.kill();
    }, 3000);
    
  }, 1000);
  
}, 1000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, terminating server...');
  server.kill();
  process.exit(0);
});

console.log('Recommended MCP Configuration (Universal npx installation):');
console.log(JSON.stringify({
  "mcpServers": {
    "replicate-minimax-image-01": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/PierrunoYT/replicate-minimax-image-01-mcp-server.git"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "r8_NBY**********************************"
      }
    }
  }
}, null, 2));
console.log('\nNOTE: This server now uses the new file-based API for minimax/image-01');