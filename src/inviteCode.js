import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from './config.js';

const INVITE_CODES_FILE = path.join(process.cwd(), 'storage', 'invite-codes.json');

class InviteCodeManager {
  constructor() {
    this.codes = this._loadCodes();
  }

  _loadCodes() {
    try {
      if (fs.existsSync(INVITE_CODES_FILE)) {
        const data = fs.readFileSync(INVITE_CODES_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading invite codes:', error);
    }
    return {};
  }

  _persistCodes() {
    try {
      fs.writeFileSync(INVITE_CODES_FILE, JSON.stringify(this.codes, null, 2));
    } catch (error) {
      console.error('Error saving invite codes:', error);
    }
  }

  generateCode() {
    const code = crypto.randomBytes(config.inviteCode.length / 2).toString('hex');
    this.codes[code] = {
      servers: [], // Array of server names created with this code
      accessCount: 0, // Number of times this code has been used to access servers
      createdAt: new Date().toISOString()
    };
    this._persistCodes();
    return code;
  }

  validateCode(code) {
    return this.codes.hasOwnProperty(code);
  }

  canCreateServer(code) {
    if (!this.validateCode(code)) return false;
    return this.codes[code].servers.length < config.inviteCode.maxServers;
  }

  canAccessServer(code) {
    if (!this.validateCode(code)) return false;
    return this.codes[code].accessCount < config.inviteCode.maxAccesses;
  }

  addServerToCode(code, serverName) {
    if (!this.canCreateServer(code)) return false;
    if (!this.codes[code].servers.includes(serverName)) {
      this.codes[code].servers.push(serverName);
      this._persistCodes();
      return true;
    }
    return false;
  }

  incrementAccess(code) {
    if (!this.canAccessServer(code)) return false;
    this.codes[code].accessCount++;
    this._persistCodes();
    return true;
  }

  getCodeInfo(code) {
    return this.codes[code];
  }

  generateBatch(count) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateCode());
    }
    return codes;
  }
}

export const inviteCodeManager = new InviteCodeManager();
export { InviteCodeManager };