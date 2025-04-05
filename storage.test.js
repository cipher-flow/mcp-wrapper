import { storage, Storage } from './storage.js';
import fs from 'fs';
import path from 'path';
import { expect } from 'chai';

describe('Storage', () => {
  const testServerName = 'testServer';
  const testABI = [{ type: 'function', name: 'test' }];

  beforeEach(() => {
    // Clear storage before each test
    const storageDir = path.join(process.cwd(), 'storage');
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true });
    }
    // Reset storage instance
    global.storage = new Storage();
  });

  it('should initialize with empty servers', () => {
    expect(storage.getAllServers()).to.deep.equal([]);
  });

  it('should save and retrieve a server', () => {
    storage.saveServer(testServerName, testABI);
    const server = storage.getServer(testServerName);
    expect(server).to.deep.equal({ abi: testABI });
  });

  it('should persist servers between instances', () => {
    storage.saveServer(testServerName, testABI);

    // Create new storage instance to simulate restart
    const newStorage = new Storage();
    const server = newStorage.getServer(testServerName);
    expect(server).to.deep.equal({ abi: testABI });
  });

  it('should handle missing server file', () => {
    const servers = storage._loadServers();
    expect(servers).to.deep.equal({});
  });

  it('should return all server names', () => {
    storage.saveServer(testServerName, testABI);
    storage.saveServer('anotherServer', testABI);
    expect(storage.getAllServers()).to.have.members([testServerName, 'anotherServer']);
  });

  it('should return undefined for non-existent server', () => {
    expect(storage.getServer('nonexistent')).to.be.undefined;
  });
});