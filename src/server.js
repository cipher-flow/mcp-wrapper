import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from 'hono';
import { DurableObject } from 'cloudflare:workers';
import { z } from "zod";
import { SSEEdgeTransport } from "./sseEdge.js";
import { ethereumService } from "./ethereum.js";
import { abiParser } from "./abiParser.js";
import { storage } from "./storage.js";
import { inviteCodeManager } from "./inviteCode.js";
import { generateBatch, saveInviteCodes } from "../scripts/generateInviteCodes.js";

// In Cloudflare environment, import cloudflare-workers static file service
let serveStaticMiddleware = null;

// Import static file service middleware
const importStaticMiddleware = async () => {
  try {
    const { serveStatic } = await import('hono/cloudflare-workers');
    return serveStatic;
  } catch (error) {
    console.error('Failed to import serveStatic middleware:', error);
    // Fallback function that returns a 404 response
    return () => (c) => c.text('Static file service not available', 404);
  }
};

// Create Hono app instance - this should only happen once at the module level
const app = new Hono();

// McpObject class for Durable Objects implementation
export class McpObject extends DurableObject {
  transport;
  server;
  state;

  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.server = null; // Will be initialized in fetch
  }

  async fetch(request) {
    const url = new URL(request.url);
    console.log('McpObject Request URL:', url.toString());

    // Extract name from the URL path
    const pathParts = url.pathname.split('/');
    const name = pathParts[pathParts.length - 2]; // Get the name from the path

    // Initialize server if not already done
    if (!this.server) {
      // Get server data from storage
      const serverData = await storage.getServer(name);
      if (serverData) {
        this.server = createMcpServer(name, serverData?.abi || []);
        console.log(`Initialized server for ${name} in Durable Object`);
      } else {
        // If no server data, create a default server
        this.server = createMcpServer(name, []);
        console.log(`Created default server for ${name} in Durable Object`);
      }
    }

    // Create transport if not exists
    if (!this.transport) {
      // Use the Durable Object ID as the session ID
      const sessionId = this.state.id.toString();
      console.log(`Creating transport with sessionId: ${sessionId}`);
      this.transport = new SSEEdgeTransport('/messages', sessionId);
    }

    if (request.method === 'GET' && url.pathname.endsWith('/sse')) {
      console.log(`Connecting server with transport, sessionId: ${this.transport.sessionId}`);
      await this.server.connect(this.transport);
      return this.transport.sseResponse;
    }

    if (request.method === 'POST' && url.pathname.endsWith('/messages')) {
      console.log(`Handling message for sessionId: ${this.transport.sessionId}`);
      return this.transport.handlePostMessage(request);
    }

    return new Response('Not Found', { status: 404 });
  }
}

// Factory function to create configured MCP server instances
function createMcpServer(name, abiInfo) {
  const server = new McpServer({
    name: name || "MCP Wrapper Server",
    version: "1.0.0"
  });

  // Add dynamic tools for each ABI function
  if (!abiInfo || !Array.isArray(abiInfo)) {
    console.log(`Invalid ABI info for ${name}`);
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
        async (args) => {
          try {
            // get invite code from name(name-inviteCode)
            const inviteCode = name.split('-').slice(-1)[0];
            // Validate invite code
            if (!(await inviteCodeManager.validateCode(inviteCode))) {
              return {
                content: [{
                  type: "text",
                  text: "Invalid invite code"
                }]
              };
            }
            // Check access limit
            if (!(await inviteCodeManager.canAccessServer(inviteCode))) {
              return {
                content: [{
                  type: "text",
                  text: "Invite code has reached maximum access limit"
                }]
              };
            }
            // Increment access count for tool usage
            await inviteCodeManager.incrementAccess(inviteCode);
            // Call the contract function
            const result = await ethereumService.callContractFunction(
              name,
              args.contractAddress,
              args.functionName,
              params.map(p => args[p]),
              abiInfo
            );
            return {
              content: [{
                type: "text",
                text: `Function ${item.name} result: ${JSON.stringify(result)}`
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Error calling ${item.name}: ${error.message}`
              }]
            };
          }
        }
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
    async (args) => {
      try {
        const inviteCode = name.split('-').slice(-1)[0];
        if (!await inviteCodeManager.validateCode(inviteCode)) {
          return {
            content: [{
              type: "text",
              text: "Invalid invite code"
            }]
          };
        }
        if (!await inviteCodeManager.canAccessServer(inviteCode)) {
          return {
            content: [{
              type: "text",
              text: "Invite code has reached maximum access limit"
            }]
          };
        }
        await inviteCodeManager.incrementAccess(inviteCode);

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
    }
  );

  // Add tool for sending signed transactions
  server.tool(
    `sendSignedTransaction-${name}`,
    {
      signedTransaction: z.string().min(1, 'Signed transaction is required')
    },
    async (args) => {
      try {
        const inviteCode = name.split('-').slice(-1)[0];
        if (!await inviteCodeManager.validateCode(inviteCode)) {
          return {
            content: [{
              type: "text",
              text: "Invalid invite code"
            }]
          };
        }
        if (!await inviteCodeManager.canAccessServer(inviteCode)) {
          return {
            content: [{
              type: "text",
              text: "Invite code has reached maximum access limit"
            }]
          };
        }
        await inviteCodeManager.incrementAccess(inviteCode);

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
    }
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
app.get('/active-servers', async (c) => {
  const inviteCode = c.req.query('inviteCode');

  if (!inviteCode) {
    return c.json({ error: "Invite code is required" }, 400);
  }

  if (!await inviteCodeManager.validateCode(inviteCode)) {
    return c.json({ error: "Invalid invite code" }, 403);
  }

  // Get servers directly from invite code info
  const codeInfo = await inviteCodeManager.getCodeInfo(inviteCode);
  if (!codeInfo) {
    return c.json({ error: "Invalid invite code" }, 403);
  }
  console.log(`===> Filtered servers for invite code ${inviteCode}: ${codeInfo.servers}`);
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
  console.log(`===> Filtered servers for invite code ${inviteCode}: ${filteredServers.join(', ')}`);
  return c.json({
    servers: serverDetails,
  });
});

// Endpoint to get or create server instance and return connection URL
app.get("/server/:name", async (c) => {
  let name = c.req.param('name');
  const abi = c.req.query('abi');
  const inviteCode = c.req.query('inviteCode');
  const chainRpcUrl = c.req.query('chainRpcUrl');
  console.log(`===> Received request for server with name: ${name}`);
  // Combine name and inviteCode
  name = `${name}-${inviteCode}`;
  console.log(`===> Server name with invite code: ${name}`);

  if (!name) {
    return c.json({ error: 'Server name is required' }, 400);
  }

  if (!inviteCode) {
    return c.json({ error: 'Invite code is required' }, 400);
  }

  // Validate invite code
  if (!await inviteCodeManager.validateCode(inviteCode)) {
    return c.json({ error: 'Invalid invite code' }, 403);
  }

  // Check if server exists and if new server can be created
  const serverExists = await inviteCodeManager.isServerExist(inviteCode, name);
  console.log(`===> Server exists: ${serverExists}`, `(type: ${typeof serverExists}, Boolean value: ${Boolean(serverExists)})`);
  if (!serverExists && !await inviteCodeManager.canCreateServer(inviteCode)) {
    return c.json({ error: 'Invite code has reached maximum server limit' }, 403);
  }

  // Check access limit
  if (!await inviteCodeManager.canAccessServer(inviteCode)) {
    return c.json({ error: 'Invite code has reached maximum access limit' }, 403);
  }

  // Create new server instance if it doesn't exist
  if (!serverExists || serverExists === false) {
    console.log(`===> Creating new server instance for name: ${name}`);

    if (!chainRpcUrl) {
      return c.json({ error: 'Chain RPC URL is required when creating a new server' }, 400);
    }
    try {
      const parsed = abiParser.parseAndStore(abi);
      const abiInfo = parsed.raw; // Get the raw ABI array
      await storage.saveServer(name, {chainRpcUrl: chainRpcUrl, abi: abiInfo}); // Persist to storage with RPC URL
      await inviteCodeManager.addServerToCode(inviteCode, name); // Track server creation with invite code
    } catch (error) {
      return c.json({ error: `Invalid ABI: ${error.message}` }, 400);
    }
  }

  // Create or get server instance for this name
  const serverData = await storage.getServer(name);
  console.log(`===> Server data for name ${name}:`, serverData);

  // Create a new Durable Object for this server
  const objectId = c.env.MCP_OBJECT.newUniqueId();
  const sessionId = objectId.toString();

  console.log(`===> Created Durable Object with sessionId: ${sessionId}`);

  return c.json({
    url: `/sse/${name}?sessionId=${sessionId}`,
    messageUrl: `/messages/${name}?sessionId=${sessionId}`,
    sessionId: sessionId
  });
});

// SSE endpoint with name parameter - using Durable Object pattern
app.get("/sse/:name", async (c) => {
  const name = c.req.param('name');
  console.log(`===> Received SSE connection request for name: ${name}`);

  const inviteCode = name.split('-').slice(-1)[0];
  const serverExists = await inviteCodeManager.isServerExist(inviteCode, name);
  if (!serverExists) {
    console.log(`===> Server instance not found for name: ${name}`);
    return c.text(`No server found for name ${name}`, 404);
  }

  // Get or create a Durable Object for this server
  const sessionId = c.req.query('sessionId');
  const objectId = sessionId ? c.env.MCP_OBJECT.idFromString(sessionId) : c.env.MCP_OBJECT.newUniqueId();
  const object = c.env.MCP_OBJECT.get(objectId);

  // Forward the request to the Durable Object
  return object.fetch(new Request(`${c.req.url}/sse`));
});

// Message endpoint with name parameter - using Durable Object pattern
app.post("/messages/:name", async (c) => {
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.text('Session ID is required', 400);
  }

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
  // Use the static middleware if available, otherwise return a 404
  if (serveStaticMiddleware) {
    return serveStaticMiddleware({ root: './public' })(c);
  }
  return new Response('Not found', { status: 404 });
});

// Set environment for inviteCodeManager and storage in Cloudflare environment
app.use('*', (c, next) => {
  if (c.env) {
    inviteCodeManager.setEnv(c.env);
    storage.setEnv(c.env);
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
  if (serveStaticMiddleware) {
    return serveStaticMiddleware({ root: './public' })(c);
  }

  // If we get here, return a 404
  return new Response('Not found', { status: 404 });
});

// Initialize static middleware only once at module level
let staticMiddlewareInitialized = false;

// Setup function to initialize the application - does not register routes
async function setupApp() {
  // Only initialize static middleware once
  if (!staticMiddlewareInitialized) {
    try {
      // Get the static file middleware
      serveStaticMiddleware = await importStaticMiddleware();
      console.log('Static middleware initialized successfully');

      // Now we can safely add the static file middleware
      // Note: We're not using app.use here to avoid middleware conflicts
      // Static files will be handled by the catch-all route

      staticMiddlewareInitialized = true;
    } catch (error) {
      console.error('Failed to initialize static middleware:', error);
    }
  }

  return app;
}

// Initialize the app once - not on every request
let initializedApp = null;

export default {
  fetch: async (request, env, ctx) => {
    // Only set up the app once
    if (!initializedApp) {
      initializedApp = await setupApp();
    }
    return initializedApp.fetch(request, env, ctx);
  },
  // Export the Durable Object class
  McpObject
};
