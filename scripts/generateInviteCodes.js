#!/usr/bin/env node

import crypto from "crypto";
import { config } from "../src/config.js";
import { inviteCodeManager } from "../src/inviteCode.js";

const count = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (isNaN(count) || count < 1) {
  console.error('Please provide a valid number of invite codes to generate');
  process.exit(1);
}

function generateCode() {
  const code = crypto.randomBytes(config.inviteCode.length / 2).toString('hex');
  return {
    [code]: {
      servers: [], // Array of server names created with this code
      accessCount: 0, // Number of times this code has been used to access servers
      createdAt: new Date().toISOString()
    }
  };
}

function generateBatch(count) {
    const codesObject = {};
    for (let i = 0; i < count; i++) {
      Object.assign(codesObject, generateCode());
    }
    return codesObject;
}

const codes = generateBatch(count);
const existingCodes = inviteCodeManager._loadCodes();
const mergedCodes = { ...existingCodes, ...codes };
inviteCodeManager._persistCodes(mergedCodes);
console.log('Generated invite codes:');
Object.keys(codes).forEach(code => console.log(code));