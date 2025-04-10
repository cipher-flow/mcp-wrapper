// Cloudflare KV storage implementation for servers
// KV namespace will be bound to the environment at runtime
// KV_SERVERS should be defined in wrangler.toml

class Storage {
  constructor() {
    // The KV namespace will be available as env.KV_SERVERS in the worker context
    this.env = null;
  }

  // Set the environment - called from the worker handler
  setEnv(env) {
    console.log('Setting environment for Storage');
    this.env = env;
  }

  // Store server configuration with rpcUrl and abi
  async saveServer(name, serverInfo) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const serverData = {
        chainRpcUrl: serverInfo.chainRpcUrl,
        abi: serverInfo.abi
      };

      await this.env.KV_SERVERS.put(name, JSON.stringify(serverData));
      console.log(`Server ${name} saved to KV storage`);
      return serverData;
    } catch (error) {
      console.error(`Error saving server ${name} to KV:`, error);
      return null;
    }
  }

  async getServer(name) {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      return await this.env.KV_SERVERS.get(name, { type: 'json' });
    } catch (error) {
      console.error(`Error getting server ${name} from KV:`, error);
      return null;
    }
  }

  async getAllServers() {
    try {
      if (!this.env) {
        throw new Error('Environment not set - call setEnv before using KV operations');
      }

      const servers = {};
      const listResult = await this.env.KV_SERVERS.list();

      const promises = listResult.keys.map(async (key) => {
        const value = await this.env.KV_SERVERS.get(key.name, { type: 'json' });
        servers[key.name] = value;
      });

      await Promise.all(promises);
      return servers;
    } catch (error) {
      console.error('Error loading servers from KV:', error);
      return {};
    }
  }
}

// Create a singleton instance
let storageInstance;

export function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage();
  }
  return storageInstance;
}

export const storage = getStorage();
export { Storage };