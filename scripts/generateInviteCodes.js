#!/usr/bin/env node
import { inviteCodeManager } from '../src/inviteCode.js';

const count = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (isNaN(count) || count < 1) {
  console.error('Please provide a valid number of invite codes to generate');
  process.exit(1);
}

const codes = inviteCodeManager.generateBatch(count);
console.log('Generated invite codes:');
codes.forEach(code => console.log(code));