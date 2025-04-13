#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const wranglerPath = path.join(rootDir, 'wrangler.jsonc');
const devVarsPath = path.join(rootDir, '.dev.vars');

// Required environment variables for wrangler.jsonc
const requiredEnvVars = [
  'INVITE_CODES_KV_ID',
  'SERVERS_KV_ID',
];

// Additional environment variables to include in .dev.vars
const additionalEnvVars = [
  'INFURA_PROJECT_ID',
  'SERVERS_PREVIEW_KV_ID',
  'INVITE_CODES_PREVIEW_KV_ID',
  'ETHERSCAN_API_KEY',
  'INVITE_CODE_LENGTH',
  'INVITE_CODE_MAX_SERVERS',
  'INVITE_CODE_MAX_ACCESSES',
];

// Check if all required environment variables are set
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file or environment before deploying.');
  process.exit(1);
}

/**
 * Updates the .dev.vars file with all environment variables
 */
function updateDevVars() {
  try {
    console.log('📝 Updating .dev.vars file with environment variables...');

    // Create content for .dev.vars file
    let devVarsContent = '';

    // Add Invite Code Configuration section
    devVarsContent += '# Invite Code Configuration\n';
    // Use additionalEnvVars array to dynamically include variables if they exist
    additionalEnvVars.forEach(varName => {
      if (process.env[varName]) {
        devVarsContent += `${varName}=${process.env[varName]}\n`;
      }
    });

    // Etherscan API key is already included in additionalEnvVars, so we don't need to add it separately

    // Add Cloudflare section
    devVarsContent += '\n# Cloudflare\n';
    // Include all required KV namespace IDs
    requiredEnvVars.forEach(varName => {
      if (process.env[varName]) {
        devVarsContent += `${varName}=${process.env[varName]}\n`;
      }
    });

    // Write to .dev.vars file
    fs.writeFileSync(devVarsPath, devVarsContent, 'utf8');
    console.log('✅ Successfully updated .dev.vars with environment variables.');
    return true;
  } catch (error) {
    console.error(`❌ Error updating .dev.vars: ${error.message}`);
    return false;
  }
}

/**
 * Updates the wrangler.jsonc file with KV namespace IDs
 */
function updateWranglerConfig() {
  try {
    console.log('📝 Reading wrangler.jsonc file...');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

    // Replace the KV namespace IDs with the values from environment variables
    console.log('🔄 Replacing KV namespace IDs with environment variables...');
    wranglerContent = wranglerContent.replace(/"\$INVITE_CODES_KV_ID"/g, `"${process.env.INVITE_CODES_KV_ID}"`);
    wranglerContent = wranglerContent.replace(/"\$SERVERS_KV_ID"/g, `"${process.env.SERVERS_KV_ID}"`);

    // Write the updated content back to the wrangler.jsonc file
    fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
    console.log('✅ Successfully updated wrangler.jsonc with KV namespace IDs from environment variables.');
    return true;
  } catch (error) {
    console.error(`❌ Error updating wrangler.jsonc: ${error.message}`);
    return false;
  }
}

// Main execution
try {
  // Update wrangler.jsonc file
  const wranglerUpdated = updateWranglerConfig();

  // Update .dev.vars file
  const devVarsUpdated = updateDevVars();

  if (wranglerUpdated && devVarsUpdated) {
    console.log('\n🎉 All configuration files have been successfully updated!');
  } else {
    console.warn('\n⚠️ Some configuration files could not be updated. Please check the errors above.');
  }

  // Provide next steps
  console.log('\n📋 Next steps:');
  console.log('1. Run `npm run wrangler:deploy` to deploy your application to Cloudflare Workers');
  console.log('2. Or run `npm run wrangler:dev` to test your application locally');

} catch (error) {
  console.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
}
