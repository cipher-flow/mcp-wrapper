// Pure in-memory storage implementation for Cloudflare Workers

class Storage {
  constructor() {
    this.servers = {};
    console.log('Using in-memory storage only');
  }

  // Store server configuration with rpcUrl and abi
  async saveServer(name, serverInfo) {
    this.servers[name] = {
      chainRpcUrl: serverInfo.chainRpcUrl,
      abi: serverInfo.abi
    };
    console.log(`Server ${name} saved to memory storage`);
    return this.servers[name];
  }

  getServer(name) {
    return this.servers[name];
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