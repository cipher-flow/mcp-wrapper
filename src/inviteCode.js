import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const INVITE_CODES_FILE = path.join(process.cwd(), 'storage', 'invite-codes.json');

class InviteCodeManager {
  constructor() {
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

  _persistCodes(codes) {
    try {
      fs.writeFileSync(INVITE_CODES_FILE, JSON.stringify(codes, null, 2));
    } catch (error) {
      console.error('Error saving invite codes:', error);
    }
  }

  validateCode(code) {
    const codes = this._loadCodes();
    return codes.hasOwnProperty(code);
  }

  getServersForCode(code) {
    const codes = this._loadCodes();
    if (!this.validateCode(code)) return [];
    return codes[code].servers;
  }

  canCreateServer(code) {
    const codes = this._loadCodes();
    if (!this.validateCode(code)) return false;
    return codes[code].servers.length < config.inviteCode.maxServers;
  }

  canAccessServer(code) {
    const codes = this._loadCodes();
    if (!this.validateCode(code)) return false;
    return codes[code].accessCount < config.inviteCode.maxAccesses;
  }

  addServerToCode(code, serverName) {
    if (!this.canCreateServer(code)) return false;
    const codes = this._loadCodes();
    if (!codes[code].servers.includes(serverName)) {
      codes[code].servers.push(serverName);
      this._persistCodes(codes);
      return true;
    }
    return false;
  }

  incrementAccess(code) {
    if (!this.canAccessServer(code)) return false;
    const codes = this._loadCodes();
    codes[code].accessCount++;
    this._persistCodes(codes);
    return true;
  }

  getCodeInfo(code) {
    const codes = this._loadCodes();
    return codes[code];
  }

  isServerExist(code, serverName) {
    const codes = this._loadCodes();
    if (!this.validateCode(code)) return false;
    return codes[code].servers.includes(serverName);
  }
}

export const inviteCodeManager = new InviteCodeManager();
export { InviteCodeManager };