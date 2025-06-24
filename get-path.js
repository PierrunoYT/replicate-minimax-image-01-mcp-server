#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the absolute path to the build directory
const buildPath = path.join(__dirname, 'build', 'index.js');

console.log('MCP Server Path:', buildPath);
console.log('\nRecommended MCP Configuration (Universal npx installation):');
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