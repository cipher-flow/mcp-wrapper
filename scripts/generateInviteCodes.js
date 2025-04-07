#!/usr/bin/env node

import crypto from "crypto";
import { config } from "../src/config.js";
import { inviteCodeManager } from "../src/inviteCode.js";

/**
 * Generate a single invite code with its initial data structure
 */
export function generateCode() {
  const code = crypto.randomBytes(config.inviteCode.length / 2).toString('hex');
  return {
    [code]: {
      servers: [], // Array of server names created with this code
      accessCount: 0, // Number of times this code has been used to access servers
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Generate a batch of invite codes
 * @param {number} count - Number of invite codes to generate
 * @returns {Object} - Invite codes object
 */
export function generateBatch(count) {
  const codesObject = {};
  for (let i = 0; i < count; i++) {
    Object.assign(codesObject, generateCode());
  }
  return codesObject;
}

/**
 * Save generated invite codes to storage
 * @param {Object} newCodes - Newly generated invite codes
 * @param {Object} inviteManager - Invite code manager instance
 */
export async function saveInviteCodes(newCodes, inviteManager = inviteCodeManager) {
  const existingCodes = await inviteManager._loadCodes();
  const mergedCodes = { ...existingCodes, ...newCodes };
  await inviteManager._persistCodes(mergedCodes);
  return Object.keys(newCodes);
}
