import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from 'hono';
import { DurableObject } from 'cloudflare:workers';
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import { SSEEdgeTransport } from "./sseEdge.js";
import { ethereumService } from "./ethereum.js";
import { abiParser } from "./abiParser.js";
import { storage } from "./storage.js";
import { inviteCodeManager } from "./inviteCode.js";
import { generateBatch, saveInviteCodes } from "../scripts/generateInviteCodes.js";
import { log } from "./logger.js";

// Create Hono app instance - this should only happen once at the module level
const app = new Hono();

// Add request ID middleware for Hono
const addRequestId = async (c, next) => {
  // Generate a unique request ID and add it to the context
  c.set('requestId', uuidv4());
  await next();
};

// Apply the request ID middleware to all routes
app.use('*', addRequestId);

// Static file service middleware
let serveStaticMiddleware = null;

// Initialize static file service middleware
const initStaticMiddleware = async () => {
  if (serveStaticMiddleware) return serveStaticMiddleware;

  try {
    const { serveStatic } = await import('hono/cloudflare-workers');
    serveStaticMiddleware = serveStatic;
    log.info('Static middleware initialized successfully');
  } catch (error) {
    log.error('Failed to import serveStatic middleware', { error: error.message, stack: error.stack });
    // Fallback function that returns a 404 response
    serveStaticMiddleware = () => (c) => c.text('Static file service not available', 404);
  }

  return serveStaticMiddleware;
};

// Environment setup helper function
const setupEnvironment = (env) => {
  if (!env) return false;

  // Initialize logger with environment
  log.init(env);

  // Set environment for managers
  inviteCodeManager.setEnv(env);
  storage.setEnv(env);

  return true;
};

// Invite code validation middleware
const validateInviteCode = async (c, next) => {
  let inviteCode;

  // Try to get inviteCode from query params, URL params, or request body
  inviteCode = c.req.query('inviteCode') || c.req.param('name')?.split('-').slice(-1)[0];

  // For POST requests, also check the request body
  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json();
      inviteCode = body.inviteCode;
    } catch (error) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
  }

  const context = { requestId: c.get('requestId'), inviteCode };

  if (!inviteCode) {
    log.warn('Missing invite code', context);
    return c.json({ error: 'Invite code is required' }, 400);
  }

  if (!await inviteCodeManager.validateCode(inviteCode)) {
    log.warn('Invalid invite code', context);
    return c.json({ error: 'Invalid invite code' }, 403);
  }

  // Check access limit
  if (!await inviteCodeManager.canAccessServer(inviteCode)) {
    log.warn('Invite code reached maximum access limit', context);
    return c.json({ error: 'Invite code has reached maximum access limit' }, 403);
  }

  c.set('validatedInviteCode', inviteCode);
  return next();
};

// Tool function wrapper for invite code validation
const withInviteCodeValidation = (name, toolFunction) => {
  return async (args) => {
    const inviteCode = name.split('-').slice(-1)[0];
    const context = { serverName: name, inviteCode, functionName: args.functionName };

    // Validate invite code
    if (!await inviteCodeManager.validateCode(inviteCode)) {
      log.warn('Invalid invite code in tool call', context);
      return {
        content: [{
          type: "text",
          text: "Invalid invite code"
        }]
      };
    }

    // Check access limit
    if (!await inviteCodeManager.canAccessServer(inviteCode)) {
      log.warn('Invite code reached maximum access limit', context);
      return {
        content: [{
          type: "text",
          text: "Invite code has reached maximum access limit"
        }]
      };
    }

    // Increment access count for tool usage
    await inviteCodeManager.incrementAccess(inviteCode);

    // Execute the actual tool function
    return toolFunction(args, context);
  };
};


// McpObject class for Durable Objects implementation
export class McpObject extends DurableObject {
  transport;
  server;
  state;

  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.server = null; // Will be initialized in fetch

    // Set environment for managers in Durable Object
    if (setupEnvironment(env)) {
      log.info('Environment set up in McpObject constructor');
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const sessionId = this.state.id.toString();
    const context = { sessionId };
    log.info('McpObject Request URL', { ...context, url: url.toString() });

    // Ensure environment is set for every request in the Durable Object
    if (this.state.id && this.state.id.env) {
      if (setupEnvironment(this.state.id.env)) {
        log.info('Environment set up in McpObject fetch', context);
      }
    }

    // Extract name from the URL path
    const pathParts = url.pathname.split('/');
    const name = pathParts[pathParts.length - 2]; // Get the name from the path

    // Initialize server if not already done
    if (!this.server) {
      // Get server data from storage
      const serverData = await storage.getServer(name);
      if (serverData) {
        this.server = createMcpServer(name, serverData?.abi || []);
        log.info(`Initialized server in Durable Object`, { ...context, serverName: name });
      } else {
        // If no server data, create a default server
        this.server = createMcpServer(name, []);
        log.info(`Created default server in Durable Object`, { ...context, serverName: name });
      }
    }

    // Create transport if not exists
    if (!this.transport) {
      // Use the Durable Object ID as the session ID
      log.info(`Creating transport`, { ...context, serverName: name });
      this.transport = new SSEEdgeTransport('/messages', sessionId);
    }

    if (request.method === 'GET' && url.pathname.endsWith('/sse')) {
      log.info(`Connecting server with transport`, { ...context, serverName: name });
      await this.server.connect(this.transport);
      return this.transport.sseResponse;
    }

    if (request.method === 'POST' && url.pathname.endsWith('/messages')) {
      log.info(`Handling message`, { ...context, serverName: name });
      return this.transport.handlePostMessage(request);
    }

    return new Response('Not Found', { status: 404 });
  }
}

// Factory function to create configured MCP server instances
function createMcpServer(name, abiInfo) {
  log.info('Creating MCP server instance', { serverName: name, abiCount: abiInfo?.length || 0 });
  const server = new McpServer({
    name: name || "MCP Wrapper Server",
    version: "1.0.0"
  });

  // Add dynamic tools for each ABI function
  if (!abiInfo || !Array.isArray(abiInfo)) {
    log.warn(`Invalid ABI info for server`, { serverName: name });
    return server;
  }

  abiInfo.forEach((item) => {
    if (item.type === 'function') {
      const paramsSchema = {};
      const params = [];

      // Build Zod schema for each input parameter
      item.inputs?.forEach((input) => {
        let schema;
        if (input.type.includes('uint') || input.type.includes('int')) {
          schema = z.string().regex(/^\d+$/, 'Must be a number');
        } else if (input.type === 'address') {
          schema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address');
        } else if (input.type === 'bool') {
          schema = z.boolean();
        } else if (input.type === 'string') {
          schema = z.string();
        } else {
          schema = z.string();
        }

        paramsSchema[input.name || `param${params.length}`] = schema;
        params.push(input.name || `param${params.length}`);
      });

      // Add tool for this function
      server.tool(
        `${item.name}-${name}`,
        {
          ...paramsSchema,
          contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
          functionName: z.string().min(1, 'Function name is required')
        },
        withInviteCodeValidation(name, async (args, context) => {
          try {

            log.info('Calling contract function', {
              ...context,
              contractAddress: args.contractAddress
            });

            // Call the contract function
            const result = await ethereumService.callContractFunction(
              name,
              args.contractAddress,
              args.functionName,
              params.map(p => args[p]),
              abiInfo
            );

            log.info('Contract function call successful', {
              ...context,
              result: JSON.stringify(result)
            });

            return {
              content: [{
                type: "text",
                text: `Function ${item.name} result: ${JSON.stringify(result)}`
              }]
            };
          } catch (error) {
            log.error(`Error calling contract function`, {
              serverName: name,
              functionName: args.functionName,
              error: error.message,
              stack: error.stack
            });

            return {
              content: [{
                type: "text",
                text: `Error calling ${item.name}: ${error.message}`
              }]
            };
          }
        })
      );
    }
  });

  // Add tool for constructing transaction data
  server.tool(
    `constructTransactionData-${name}`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
      functionName: z.string().min(1, 'Function name is required'),
      params: z.array(z.string())
    },
    withInviteCodeValidation(name, async (args) => {
      try {

        const txData = await ethereumService.constructTransactionData(
          name,
          args.contractAddress,
          args.functionName,
          args.params,
          abiInfo
        );
        return {
          content: [{
            type: "text",
            text: `Transaction data: ${JSON.stringify(txData)}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error constructing transaction data: ${error.message}`
          }]
        };
      }
    })
  );

  // Add tool for sending signed transactions
  server.tool(
    `sendSignedTransaction-${name}`,
    {
      signedTransaction: z.string().min(1, 'Signed transaction is required')
    },
    withInviteCodeValidation(name, async (args) => {
      try {

        const receipt = await ethereumService.sendSignedTransaction(
          name,
          args.signedTransaction
        );
        return {
          content: [{
            type: "text",
            text: `Transaction sent! Receipt: ${JSON.stringify(receipt)}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error sending transaction: ${error.message}`
          }]
        };
      }
    })
  );

  // Resource for full ABI
  server.resource(
    `abi-${name}`,
    new ResourceTemplate("abi://{name}", { list: undefined }),
    async () => ({
      contents: [{
        uri: `abi://${name}`,
        text: JSON.stringify(abiInfo)
      }]
    })
  );

  // Resources for each function
  abiInfo.filter(item => item.type === 'function').forEach(item => {
    server.resource(
      `abi-function-${item.name}-${name}`,
      new ResourceTemplate(`abi-function://{name}/${item.name}`, { list: undefined }),
      async () => ({
        contents: [{
          uri: `abi-function://${name}/${item.name}`,
          text: JSON.stringify(item)
        }]
      })
    );
  });

  // Prompt templates for common contract interactions
  server.prompt(
    `contract-info-${name}`,
    {},
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Here is the ABI for contract ${name}: ${JSON.stringify(abiInfo)}. ` +
            `What functions are available and what do they do?`
        }
      }]
    })
  );

  server.prompt(
    `contract-function-${name}`,
    { functionName: z.string() },
    ({ functionName }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Explain how to use the ${functionName} function from contract ${name}. ` +
            `Include parameter types and expected return values.`
        }
      }]
    })
  );

  return server;
}

// Endpoint to get active servers
app.get('/active-servers', validateInviteCode, async (c) => {
  const inviteCode = c.get('validatedInviteCode');
  const context = { requestId: c.get('requestId'), inviteCode };

  // Get servers directly from invite code info
  const codeInfo = await inviteCodeManager.getCodeInfo(inviteCode);
  if (!codeInfo) {
    log.warn('Invalid invite code info in active-servers request', context);
    return c.json({ error: "Invalid invite code" }, 403);
  }

  log.info('Retrieving servers for invite code', context);
  const filteredServers = codeInfo?.servers || [];

  // Get server details including RPC URLs
  const serverDetailPromises = filteredServers.map(async (name) => {
    const serverData = await storage.getServer(name);
    return {
      name,
      chainRpcUrl: serverData?.chainRpcUrl || 'Not configured'
    };
  });
  const serverDetails = await Promise.all(serverDetailPromises);

  log.info('Retrieved server details', { ...context, serverCount: serverDetails.length });
  return c.json({
    servers: serverDetails,
  });
});

// Endpoint to get or create server instance and return connection URL
app.post("/server/:name", validateInviteCode, async (c) => {
  let name = c.req.param('name');
  const context = { requestId: c.get('requestId'), serverName: name };
  const inviteCode = c.get('validatedInviteCode');
  let body = await c.req.json();

  log.info("Received request for server", body);

  // Extract parameters from body
  const abi = body.abi;
  const chainRpcUrl = body.chainRpcUrl;

  log.info('Received request for server', context);

  // Combine name and inviteCode
  name = `${name}-${inviteCode}`;

  log.info('Server name with invite code', { ...context, fullServerName: name });

  if (!name) {
    log.warn('Missing server name', context);
    return c.json({ error: 'Server name is required' }, 400);
  }

  // Check if server exists and if new server can be created
  const serverExists = await inviteCodeManager.isServerExist(inviteCode, name);
  log.info('Server existence check', { ...context, exists: serverExists });

  if (!serverExists && !await inviteCodeManager.canCreateServer(inviteCode)) {
    log.warn('Invite code reached maximum server limit', context);
    return c.json({ error: 'Invite code has reached maximum server limit' }, 403);
  }

  // Create new server instance if it doesn't exist
  if (!serverExists || serverExists === false) {
    log.info('Creating new server instance', context);

    if (!chainRpcUrl) {
      log.warn('Missing Chain RPC URL for new server', context);
      return c.json({ error: 'Chain RPC URL is required when creating a new server' }, 400);
    }
    try {
      const parsed = abiParser.parseAndStore(abi);
      const abiInfo = parsed.raw; // Get the raw ABI array
      await storage.saveServer(name, { chainRpcUrl: chainRpcUrl, abi: abiInfo }); // Persist to storage with RPC URL
      await inviteCodeManager.addServerToCode(inviteCode, name); // Track server creation with invite code
      log.info('Server created successfully', { ...context, abiCount: abiInfo.length });
    } catch (error) {
      log.error('Failed to parse ABI', { ...context, error: error.message });
      return c.json({ error: `Invalid ABI: ${error.message}` }, 400);
    }
  }

  // Create or get server instance for this name
  const serverData = await storage.getServer(name);
  log.info('Retrieved server data', { ...context, hasData: !!serverData });

  return c.json({
    url: `/sse/${name}`,
    messageUrl: `/messages/${name}`,
  });
});

// SSE endpoint with name parameter - using Durable Object pattern
app.get("/sse/:name", async (c) => {
  const name = c.req.param('name');
  const inviteCode = name.split('-').slice(-1)[0];
  const context = { requestId: c.get('requestId'), serverName: name, inviteCode };

  log.info('Received SSE connection request', context);

  const serverExists = await inviteCodeManager.isServerExist(inviteCode, name);
  if (!serverExists) {
    log.warn('Server instance not found', context);
    return c.text(`No server found for name ${name}`, 404);
  }

  // Get or create a Durable Object for this server
  const sessionId = c.req.query('sessionId');
  const objectId = sessionId ? c.env.MCP_OBJECT.idFromString(sessionId) : c.env.MCP_OBJECT.newUniqueId();
  const object = c.env.MCP_OBJECT.get(objectId);

  log.info('Forwarding SSE request to Durable Object', { ...context, sessionId });

  // Forward the request to the Durable Object
  return object.fetch(new Request(`${c.req.url}/sse`));
});

// Message endpoint with name parameter - using Durable Object pattern
app.post("/messages/:name", async (c) => {
  const name = c.req.param('name');
  const sessionId = c.req.query('sessionId');
  const context = { requestId: c.get('requestId'), serverName: name, sessionId };

  if (!sessionId) {
    log.warn('Missing session ID in message request', context);
    return c.text('Session ID is required', 400);
  }

  log.info('Handling message request', context);

  // Get the Durable Object for this session
  const objectId = c.env.MCP_OBJECT.idFromString(sessionId);
  const object = c.env.MCP_OBJECT.get(objectId);

  // Forward the request to the Durable Object
  return object.fetch(new Request(`${c.req.url}/messages`));
});

// Simple ping endpoint for API testing
app.get('/api/ping', (c) => {
  return c.text('pong');
});

// Add Etherscan ABI fetching endpoint
app.get('/api/fetch-abi', async (c) => {
  const address = c.req.query('address');
  const network = c.req.query('network') || 'mainnet';

  const context = { requestId: c.get('requestId') };

  if (!address) {
    log.warn('Missing contract address in fetch-abi request', context);
    return c.json({ error: 'Contract address is required' }, 400);
  }

  const etherscanApiKey = c.env.ETHERSCAN_API_KEY;
  if (!etherscanApiKey) {
    log.error('Etherscan API key not configured', context);
    return c.json({ error: 'Etherscan API key not configured' }, 500);
  }

  // Map network to chainId for Etherscan V2 API
  const networkToChainId = {
    'mainnet': 1,
    'sepolia': 11155111,
    'arbitrum': 42161,
    'optimism': 10,
    'base': 8453,
    'polygon': 137
  };

  try {
    const chainId = networkToChainId[network] || 1; // Default to mainnet if network not found

    log.info('Fetching ABI from Etherscan V2 API', { ...context, address, network, chainId });

    // Use Etherscan V2 API with chainId parameter
    const response = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${address}&apikey=${etherscanApiKey}`
    );
    const data = await response.json();

    if (data.status === '0') {
      log.warn('Etherscan API returned error', { ...context, error: data.result });
      return c.json({ error: data.result }, 400);
    }

    try {
      const abi = JSON.parse(data.result);
      log.info('Successfully fetched ABI from Etherscan V2 API', { ...context, address, chainId });
      return c.json({ abi });
    } catch (e) {
      log.error('Invalid ABI format received from Etherscan V2 API', { ...context, error: e.message, chainId });
      return c.json({ error: 'Invalid ABI format received from Etherscan V2 API' }, 400);
    }
  } catch (error) {
    log.error('Failed to fetch ABI from Etherscan V2 API', { ...context, error: error.message, stack: error.stack, network, chainId: networkToChainId[network] || 1 });
    return c.json({ error: 'Failed to fetch ABI from Etherscan V2 API' }, 500);
  }
});

// Generate invite codes API
app.post('/api/invite-codes', async (c) => {
  try {
    // Check authorization - in production you would want proper auth
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse request body for count
    const body = await c.req.json();
    const count = body.count ? parseInt(body.count) : 1;

    if (isNaN(count) || count < 1 || count > 100) {
      return c.json({ error: 'Invalid count. Must be between 1 and 100.' }, 400);
    }

    // Generate invite codes
    const newCodes = generateBatch(count);

    // Make sure inviteCodeManager and storage have access to the environment
    if (c.env) {
      inviteCodeManager.setEnv(c.env);
      storage.setEnv(c.env);
    } else {
      return c.json({ error: 'Environment not available' }, 500);
    }

    // Save to KV and get generated codes list
    const generatedCodes = await saveInviteCodes(newCodes, inviteCodeManager);

    return c.json({
      success: true,
      count: generatedCodes.length,
      codes: generatedCodes
    });
  } catch (error) {
    console.error('Error generating invite codes:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Root path route, redirects to index.html
app.get('/', (c) => {
  return c.redirect('/index.html');
});

// Handle favicon.ico request explicitly
app.get('/favicon.ico', async (c) => {
  // Initialize static middleware if needed
  const staticMiddleware = await initStaticMiddleware();
  return staticMiddleware({ root: './public' })(c);
});

// Set environment for inviteCodeManager and storage in Cloudflare environment
app.use('*', (c, next) => {
  if (setupEnvironment(c.env)) {
    log.debug('Environment set up in middleware');
  }
  return next();
});

// Catch-all route for Durable Object pattern and static files
app.all('*', async (c) => {
  const sessionId = c.req.query('sessionId');

  if (sessionId) {
    const objectId = c.env.MCP_OBJECT.idFromString(sessionId);
    const object = c.env.MCP_OBJECT.get(objectId);
    return object.fetch(c.req.raw);
  }

  // If no sessionId, try to serve as a static file
  const staticMiddleware = await initStaticMiddleware();
  return staticMiddleware({ root: './public' })(c);
});

// Setup function to initialize the application
async function setupApp() {
  // Initialize static middleware
  await initStaticMiddleware();
  return app;
}

// Initialize the app once - not on every request
let initializedApp = null;

export default {
  fetch: async (request, env, ctx) => {
    // Set environment for managers at the top level of every request
    if (setupEnvironment(env)) {
      log.info('Environment set up in main fetch handler');
    }

    // Only set up the app once
    if (!initializedApp) {
      log.info('Initializing Hono app');
      initializedApp = await setupApp();
    }
    return initializedApp.fetch(request, env, ctx);
  },
  // Export the Durable Object class
  McpObject
};