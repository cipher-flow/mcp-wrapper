import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const SERVERS_FILE = path.join(STORAGE_DIR, 'servers.json');

class Storage {
  constructor() {
    this._ensureStorageDir();
    this.servers = this._loadServers();
  }

  _ensureStorageDir() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  _loadServers() {
    try {
      if (fs.existsSync(SERVERS_FILE)) {
        const data = fs.readFileSync(SERVERS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    }
    return {};
  }

  // Store server configuration with rpcUrl and abi
  saveServer(name, serverInfo) {
    this.servers[name] = {
      chainRpcUrl: serverInfo.chainRpcUrl,
      abi: serverInfo.abi
    };
    this._persistServers();
  }

  getServer(name) {
    return this.servers[name];
  }

  getAllServers() {
    return Object.keys(this.servers);
  }

  _persistServers() {
    try {
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(this.servers, null, 2));
    } catch (error) {
      console.error('Error saving servers:', error);
    }
  }
}

export const storage = new Storage();
export { Storage };