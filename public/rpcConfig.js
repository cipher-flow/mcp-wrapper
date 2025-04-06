import { storage } from '../storage.js';

// RPC URL configuration manager
class RpcConfigManager {
    constructor() {
    }

    async saveRpcUrl(serverName, url) {
        try {
            const server = storage.getServer(serverName) || {};
            server.rpcUrl = url;
            storage.saveServer(serverName, server.abi);
            return true;
        } catch (error) {
            console.error('Failed to save RPC URL:', error);
            throw error;
        }
    }

    async getRpcUrl(serverName) {
        try {
            const server = storage.getServer(serverName);
            return server?.rpcUrl || null;
        } catch (error) {
            console.error('Failed to get RPC URL:', error);
            return null;
        }
    }
}

export const rpcConfigManager = new RpcConfigManager();