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

// Environment variables to include in wrangler.jsonc vars section
const wranglerVarsEnvVars = [
  'INVITE_CODE_LENGTH',
  'INVITE_CODE_MAX_SERVERS',
  'INVITE_CODE_MAX_ACCESSES',
  'INFURA_PROJECT_ID',
  'ETHERSCAN_API_KEY',
];

// Check if all required environment variables are set
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file or environment before deploying.');
  process.exit(1);
}

/**
 * Updates the wrangler.jsonc file with KV namespace IDs and environment variables
 */
function updateWranglerEnv() {
  try {
    console.log('📝 Reading wrangler.jsonc file...');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

    // Replace the KV namespace IDs with the values from environment variables
    console.log('🔄 Replacing KV namespace IDs with environment variables...');
    wranglerContent = wranglerContent.replace(/"\$INVITE_CODES_KV_ID"/g, `"${process.env.INVITE_CODES_KV_ID}"`);
    wranglerContent = wranglerContent.replace(/"\$SERVERS_KV_ID"/g, `"${process.env.SERVERS_KV_ID}"`);

    // Update the vars section with environment variables
    console.log('🔄 Updating vars section with environment variables...');
    try {
      // Parse the wrangler.jsonc content
      // Remove comments before parsing
      const jsonContent = wranglerContent.replace(/\/\/.*$/gm, '').replace(/#.*$/gm, '');
      const wranglerJson = JSON.parse(jsonContent);

      // Ensure vars section exists
      if (!wranglerJson.vars) {
        wranglerJson.vars = {};
      }

      // Add environment variables to vars section
      wranglerVarsEnvVars.forEach(varName => {
        if (process.env[varName]) {
          // Try to parse as number if it looks like one
          const value = !isNaN(process.env[varName]) && process.env[varName].trim() !== ''
            ? Number(process.env[varName])
            : process.env[varName];
          wranglerJson.vars[varName] = value;
          console.log(`Added ${varName}=${value} to wrangler.jsonc vars`);
        }
      });

      // Convert back to string with proper formatting
      wranglerContent = JSON.stringify(wranglerJson, null, 4);
    } catch (jsonError) {
      console.warn(`⚠️ Could not parse wrangler.jsonc as JSON: ${jsonError.message}`);
      console.warn('Falling back to regex-based replacement for vars section...');

      // Fallback: Use regex to update the vars section
      const varsRegex = /("vars"\s*:\s*\{[^\}]*)(\})/s;
      if (varsRegex.test(wranglerContent)) {
        wranglerContent = wranglerContent.replace(varsRegex, (_, prefix, suffix) => {
          let newVars = prefix;
          wranglerVarsEnvVars.forEach(varName => {
            if (process.env[varName]) {
              const value = !isNaN(process.env[varName]) && process.env[varName].trim() !== ''
                ? process.env[varName]
                : `"${process.env[varName]}"`;
              newVars += `\n        "${varName}": ${value},`;
            }
          });
          return newVars + suffix;
        });
      } else {
        console.warn('⚠️ Could not find vars section in wrangler.jsonc');
      }
    }

    // Write the updated content back to the wrangler.jsonc file
    fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
    console.log('✅ Successfully updated wrangler.jsonc with environment variables.');
    return true;
  } catch (error) {
    console.error(`❌ Error updating wrangler.jsonc: ${error.message}`);
    return false;
  }
}

// Main execution
try {
  // Update wrangler.jsonc file
  const wranglerUpdated = updateWranglerEnv();

  if (wranglerUpdated) {
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
