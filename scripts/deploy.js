#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const wranglerPath = path.join(rootDir, 'wrangler.jsonc');

// Required environment variables
const requiredEnvVars = [
  'INVITE_CODES_KV_ID',
  'INVITE_CODES_PREVIEW_KV_ID',
  'SERVERS_KV_ID',
  'SERVERS_PREVIEW_KV_ID'
];

// Check if all required environment variables are set
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file or environment before deploying.');
  process.exit(1);
}

// Read the wrangler.jsonc file
try {
  console.log('📝 Reading wrangler.jsonc file...');
  let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  
  // Replace the KV namespace IDs with the values from environment variables
  console.log('🔄 Replacing KV namespace IDs with environment variables...');
  wranglerContent = wranglerContent.replace(/"\$INVITE_CODES_KV_ID"/g, `"${process.env.INVITE_CODES_KV_ID}"`);
  wranglerContent = wranglerContent.replace(/"\$INVITE_CODES_PREVIEW_KV_ID"/g, `"${process.env.INVITE_CODES_PREVIEW_KV_ID}"`);
  wranglerContent = wranglerContent.replace(/"\$SERVERS_KV_ID"/g, `"${process.env.SERVERS_KV_ID}"`);
  wranglerContent = wranglerContent.replace(/"\$SERVERS_PREVIEW_KV_ID"/g, `"${process.env.SERVERS_PREVIEW_KV_ID}"`);
  
  // Write the updated content back to the wrangler.jsonc file
  fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
  console.log('✅ Successfully updated wrangler.jsonc with KV namespace IDs from environment variables.');
  
  // Provide next steps
  console.log('\n📋 Next steps:');
  console.log('1. Run `npm run wrangler:deploy` to deploy your application to Cloudflare Workers');
  console.log('2. Or run `npm run wrangler:dev` to test your application locally');
  
} catch (error) {
  console.error(`❌ Error updating wrangler.jsonc: ${error.message}`);
  process.exit(1);
}
