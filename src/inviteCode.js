import { config } from './config.js';

// KV namespace will be bound to the environment at runtime
// INVITE_CODES should be defined in wrangler.toml

class InviteCodeManager {
  constructor() {
    // The KV namespace will be available as env.INVITE_CODES in the worker context
    this.env = null;
  }

  // Set the environment - called from the worker handler
  setEnv(env) {
    console.log('Setting environment for InviteCodeManager');
    this.env = env;
  }

  async _loadCodes() {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      // Get all keys from KV namespace
      const codes = {};
      const listResult = await this.env.INVITE_CODES.list();

      // Fetch each value
      const promises = listResult.keys.map(async (key) => {
        const value = await this.env.INVITE_CODES.get(key.name, { type: 'json' });
        codes[key.name] = value;
      });

      await Promise.all(promises);
      return codes;
    } catch (error) {
      console.error('Error loading invite codes from KV:', error);
      return {};
    }
  }

  async _persistCodes(codes) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      // Put each code in KV separately
      const promises = Object.entries(codes).map(([key, value]) => {
        return this.env.INVITE_CODES.put(key, JSON.stringify(value));
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error saving invite codes to KV:', error);
    }
  }

  async validateCode(code) {
    try {
      console.log(`Validating code: ${code}, env exists: ${!!this.env}`);
      if (!this.env) {
        console.error('Environment not set in validateCode - this should not happen');
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      // Check if the code exists directly
      console.log(`Attempting to get code ${code} from KV`);
      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      console.log(`Code ${code} exists: ${value !== null}`);
      return value !== null;
    } catch (error) {
      console.error(`Error validating code ${code}:`, error);
      return false;
    }
  }

  async getServersForCode(code) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      return value ? value.servers : [];
    } catch (error) {
      console.error('Error getting servers for code:', error);
      return [];
    }
  }

  async canCreateServer(code) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      if (!value) return false;
      return value.servers.length < config.inviteCode.maxServers;
    } catch (error) {
      console.error('Error checking if can create server:', error);
      return false;
    }
  }

  async canAccessServer(code) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      if (!value) return false;
      return value.accessCount < config.inviteCode.maxAccesses;
    } catch (error) {
      console.error('Error checking if can access server:', error);
      return false;
    }
  }

  async addServerToCode(code, serverName) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      if (!(await this.canCreateServer(code))) return false;

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      if (!value) return false;

      if (!value.servers.includes(serverName)) {
        value.servers.push(serverName);
        await this.env.INVITE_CODES.put(code, JSON.stringify(value));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding server to code:', error);
      return false;
    }
  }

  async incrementAccess(code) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      if (!(await this.canAccessServer(code))) return false;

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      if (!value) return false;

      value.accessCount++;
      await this.env.INVITE_CODES.put(code, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error incrementing access:', error);
      return false;
    }
  }

  async getCodeInfo(code) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      return await this.env.INVITE_CODES.get(code, { type: 'json' });
    } catch (error) {
      console.error('Error getting code info:', error);
      return null;
    }
  }

  async isServerExist(code, serverName) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const value = await this.env.INVITE_CODES.get(code, { type: 'json' });
      console.log('Value:', value);
      if (!value) return false;
      return value.servers.includes(serverName);
    } catch (error) {
      console.error('Error checking server existence:', error);
      return false;
    }
  }
}

export const inviteCodeManager = new InviteCodeManager();
export { InviteCodeManager };