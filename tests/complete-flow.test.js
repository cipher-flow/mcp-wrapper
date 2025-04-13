/**
 * Complete Flow Test
 *
 * Test Steps:
 * 1. Generate invite code via /api/invite-codes
 * 2. Create new MCP server using invite code and /server/:name endpoint
 * 3. Activate MCP server by calling /active-servers
 * 4. Create MCP client to test tools functionality with generated MCP server
 */

import fetch from 'node-fetch';
import {jest} from '@jest/globals';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";


// Using node-fetch in Node.js environment
global.fetch = fetch;

// Test configuration
const baseUrl = 'http://127.0.0.1:3000';
const testAddress = '0x524bC91Dc82d6b90EF29F76A3ECAaBAffFD490Bc';
const serverName = 'test-server';
const chainRpcUrl = 'https://bsc-rpc.publicnode.com'; // Test RPC, can be modified later

// Sample ABI
const sampleABI = [{
    "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{
        "name": "", "type": "uint256"
    }], "payable": false, "stateMutability": "view", "type": "function"
}, {
    "constant": true, "inputs": [{
        "name": "_owner", "type": "address"
    }], "name": "balanceOf", "outputs": [{
        "name": "balance", "type": "uint256"
    }], "payable": false, "stateMutability": "view", "type": "function"
}, {
    "anonymous": false, "inputs": [{
        "indexed": true, "name": "from", "type": "address"
    }, {
        "indexed": true, "name": "to", "type": "address"
    }, {
        "indexed": false, "name": "value", "type": "uint256"
    }], "name": "Transfer", "type": "event"
}];

describe('MCP Complete Flow Test', () => {
    // Test variables
    let inviteCode;
    let fullServerName;
    let serverUrl;
    let messageUrl;
    let sessionId;
    let client;

    // Increase test timeout due to network requests
    jest.setTimeout(30000);

    // Test setup
    beforeAll(async () => {
        console.log('Setting up test environment...');
    });

    // Test cleanup
    afterAll(async () => {
        // Disconnect client connection (if exists)
        if (client) {
            try {
                // Use real client's close method to disconnect
                if (typeof client.close === 'function') {
                    await client.close();
                } else if (typeof client.disconnect === 'function') {
                    await client.disconnect();
                }
                console.log('Disconnected MCP client connection');
            } catch (error) {
                console.error('Error disconnecting client:', error);
            }
        }
        console.log('Test completed');
    });

    // Test 1: Generate invite code
    test('Should successfully generate invite code', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/invite-codes`, {
                method: 'POST', headers: {
                    'Content-Type': 'application/json', 'Authorization': 'Bearer test-token'
                }, body: JSON.stringify({count: 1})
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.codes.length).toBeGreaterThan(0);

            // Save invite code for subsequent tests
            inviteCode = data.codes[0];
            console.log(`Generated invite code: ${inviteCode}`);
        } catch (error) {
            console.error('Error generating invite code:', error);
            throw error;
        }
    });

    // Test 2: Create MCP server
    test('Should successfully create MCP server using invite code', async () => {
        try {
            // Use POST request to create server, parameters in request body
            const requestUrl = `${baseUrl}/server/${serverName}`;
            console.log("requestUrl", requestUrl);
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inviteCode: inviteCode,
                    chainRpcUrl: chainRpcUrl,
                    abi: sampleABI
                })
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('url');
            expect(data).toHaveProperty('messageUrl');

            // Save server details for subsequent tests
            serverUrl = data.url;
            messageUrl = data.messageUrl;
            fullServerName = `${serverName}-${inviteCode}`;

            console.log(`Created server: ${fullServerName}`);
            console.log(`Server URL: ${serverUrl}`);
            console.log(`Message URL: ${messageUrl}`);
        } catch (error) {
            console.error('Error creating MCP server:', error);
            throw error;
        }
    });

    // Test 3: Activate MCP server
    test('Should successfully activate MCP server', async () => {
        try {
            const response = await fetch(`${baseUrl}/active-servers?inviteCode=${inviteCode}`, {
                method: 'GET', headers: {
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('servers');

            // Server list should contain our server
            const serverFound = data.servers.some(server => server.name && server.name.includes(serverName));
            expect(serverFound).toBe(true);

            console.log(`Activated servers: ${JSON.stringify(data.servers)}`);
        } catch (error) {
            console.error('Error activating MCP server:', error);
            throw error;
        }
    });

    // Test 4: Create MCP client and call tools
    test('Should successfully create MCP client and call tools', async () => {
        try {
            // Build server URL and create transport layer
            const mcpServer = `${baseUrl}/sse/${fullServerName}`;

            console.log(`MCP server URL: ${mcpServer}`);

            const transport = new StdioClientTransport({
                command: "npx",
                 args: ["-y", "supergateway", "--sse", mcpServer],
            });

            const client = new Client(
                {
                    name: "example-client",
                    version: "1.0.0"
                }
            );

            await client.connect(transport);

            try {

                // List prompts
                const tools = await client.listTools();

                console.log(`Available tools: ${JSON.stringify(tools)}`);

                // Get a result
                const result = await client.callTool({
                    name: "totalSupply-" + fullServerName,
                    arguments: {
                        contractAddress: testAddress,
                        functionName: "totalSupply"
                    },
                });

                console.log(`Tool call successful, returned result: ${JSON.stringify(result)}`);
            } catch (startError) {
                console.error('Error connecting to MCP server:', startError);
                throw startError;
            }
        } catch (error) {
            console.error('Error in MCP client test:', error);
            throw error; // This should be a real error, so we fail the test
        } finally {
            console.log("Test completed")
        }
    });

    // Helper function: List tools (now a test utility function, not internal)
    async function listTools() {
        try {
            console.log('Fetching available tools list...');
            const toolsRequest = {
                method: 'tools/list',
                params: {}
            };

            const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

            // Validate response
            expect(toolsResult).toBeDefined();
            expect(toolsResult.tools).toBeDefined();
            expect(Array.isArray(toolsResult.tools)).toBe(true);

            console.log('Available tools:', toolsResult.tools.map(t => t.name).join(', '));
            return toolsResult.tools;
        } catch (error) {
            console.error(`Error getting tools list: ${error.message}`);
            // Fail test with clear error message
            expect(error).toBeUndefined();
            return [];
        }
    }

    // Helper function: Call contract tool (now a test utility function, not internal)
    async function callContractTool(tools) {
        try {
            console.log('Testing contract tool calls...');
            expect(tools).toBeDefined();
            expect(Array.isArray(tools)).toBe(true);

            // Find totalSupply tool
            const totalSupplyTool = tools.find(tool => tool.name.includes('totalSupply'));

            if (totalSupplyTool) {
                console.log(`Found totalSupply tool: ${totalSupplyTool.name}`);

                // Validate tool interface
                expect(totalSupplyTool.name).toBeDefined();
                expect(totalSupplyTool.description).toBeDefined();

                // Prepare contract call parameters
                const callParams = {
                    contractAddress: testAddress,
                    functionName: 'totalSupply'
                };

                // Call totalSupply tool
                const callToolRequest = {
                    method: 'tools/call',
                    params: {
                        name: totalSupplyTool.name,
                        arguments: callParams
                    }
                };

                console.log(`Calling tool ${totalSupplyTool.name} with params:`, callParams);
                const supplyResult = await client.request(callToolRequest, CallToolResultSchema);

                // Validate result
                expect(supplyResult).toBeDefined();
                expect(supplyResult.content).toBeDefined();

                console.log(`Total supply query result:`, supplyResult);

                // Test balanceOf call (if this tool exists)
                await testBalanceOfTool(tools);

                return supplyResult;
            } else {
                console.log('TotalSupply tool not found, skipping test');
                // Don't fail directly, but log warning
                console.warn('Warning: TotalSupply tool not found, this may indicate incomplete MCP server configuration');
            }
        } catch (error) {
            console.error(`Error calling contract tool: ${error.message}`);
            // Fail test with clear error message
            expect(error).toBeUndefined();
        }
    }

    // Test balanceOf tool (new function)
    async function testBalanceOfTool(tools) {
        try {
            // Find balanceOf tool
            const balanceOfTool = tools.find(tool => tool.name.includes('balanceOf'));

            if (balanceOfTool) {
                console.log(`Found balanceOf tool: ${balanceOfTool.name}`);

                // Call balanceOf tool
                const callToolRequest = {
                    method: 'tools/call',
                    params: {
                        name: balanceOfTool.name,
                        arguments: {
                            contractAddress: testAddress,
                            _owner: testAddress,  // Use same address to query balance
                            functionName: 'balanceOf'
                        }
                    }
                };

                const balanceResult = await client.request(callToolRequest, CallToolResultSchema);

                // Validate result
                expect(balanceResult).toBeDefined();
                expect(balanceResult.content).toBeDefined();

                console.log(`Address balance query result:`, balanceResult);
                return balanceResult;
            } else {
                console.log('BalanceOf tool not found, skipping balance test');
            }
        } catch (error) {
            console.log(`Error calling balanceOf tool (non-fatal): ${error.message}`);
            // Don't fail test as this is additional testing
        }
    }
});
