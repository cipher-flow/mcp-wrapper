import { storage, Storage } from '../src/storage.js';
import fs from 'fs';
import path from 'path';

describe('Storage', () => {
  const testServerName = 'testServer';
  const testABI = [{ type: 'function', name: 'test' }];
  const testChainRpcUrl = 'test-rpc.com';

  beforeEach(() => {
    // Clear storage before each test
    const storageDir = path.join(process.cwd(), 'storage');
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true });
    }
    // Reset storage instance
    global.storage = new Storage();
  });

  it('should save and retrieve a server', () => {
    storage.saveServer(testServerName, { abi: testABI, chainRpcUrl: testChainRpcUrl });
    const server = storage.getServer(testServerName);
    expect(server).toEqual({
      abi: testABI,
      chainRpcUrl: testChainRpcUrl,
    });
  });

  it('should persist servers between instances', () => {
    storage.saveServer(testServerName, { abi: testABI });

    // Create new storage instance to simulate restart
    const newStorage = new Storage();
    const server = newStorage.getServer(testServerName);
    expect(server).toEqual({ abi: testABI });
  });

  it('should handle missing server file', () => {
    const servers = storage._loadServers();
    expect(servers).toEqual({});
  });

  it('should return undefined for non-existent server', () => {
    expect(storage.getServer('nonexistent')).toBeUndefined();
  });
});