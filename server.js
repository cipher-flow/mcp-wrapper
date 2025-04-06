import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { ethereumService } from "./ethereum.js";
import { abiParser } from "./abiParser.js";
import { storage } from "./storage.js";
import { inviteCodeManager } from "./inviteCode.js";

const app = express();

// Factory function to create configured MCP server instances
function createMcpServer(name, abiInfo) {
  console.log(`Creating new MCP server instance for ${name}`);
  const server = new McpServer({
    name: name || "MCP Wrapper Server",
    version: "1.0.0"
  });
  console.log(`Server instance created for ${name}`);

  // Add dynamic tools for each ABI function
  if (!abiInfo || !Array.isArray(abiInfo)) {
    console.log(`Invalid ABI info for ${name}`);
    return server;
  };
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
      // print tool name
      console.log(`Adding tool ${item.name} for ${name}`);
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
            console.log(`Invite code for ${name}: ${inviteCode}`);
            // Validate invite code
            if (!inviteCodeManager.validateCode(inviteCode)) {
              return {
                content: [{
                  type: "text",
                  text: "Invalid invite code"
                }]
              };
            }
            // Check access limit
            if (!inviteCodeManager.canAccessServer(inviteCode)) {
              return {
                content: [{
                  type: "text",
                  text: "Invite code has reached maximum access limit"
                }]
              };
            }
            // Increment access count for tool usage
            inviteCodeManager.incrementAccess(inviteCode);
            // Call the contract function
            console.log(`Calling function ${item.name} on contract ${args.contractAddress}`);
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

  console.log(`Registering contract function prompt for ${name}`);
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
app.get('/active-servers', (req, res) => {
  const { inviteCode } = req.query;

  if (!inviteCode) {
    return res.status(400).json({ error: "Invite code is required" });
  }

  if (!inviteCodeManager.validateCode(inviteCode)) {
    return res.status(403).json({ error: "Invalid invite code" });
  }

  // Get servers directly from invite code info
  const codeInfo = inviteCodeManager.getCodeInfo(inviteCode);
  const filteredServers = codeInfo?.servers || [];
  // Get server details including RPC URLs
  const serverDetails = filteredServers.map(name => {
    const serverData = storage.getServer(name);
    return {
      name,
      chainRpcUrl: serverData?.chainRpcUrl || 'Not configured'
    };
  });
  // print filteredServers
  console.log(`===> Filtered servers for invite code ${inviteCode}: ${filteredServers.join(', ')}`);
  res.json({
    servers: serverDetails,
  });
});

// Store active servers by name
const servers = {};
// Initialize servers from storage on startup
for (const name of storage.getAllServers()) {
  const serverData = storage.getServer(name);
  if (serverData?.abi) {
    servers[name] = createMcpServer(name, serverData.abi);
    if (serverData.chainRpcUrl) {
      ethereumService.setRpcUrl(name, serverData.chainRpcUrl);
    }
  }
}
// Store active SSE transports by name
const transports = {};

// Endpoint to get or create server instance and return connection URL
app.get("/server/:name", async (req, res) => {
  let { name } = req.params;
  const { abi, inviteCode, chainRpcUrl } = req.query;
  console.log(`===> Received request for server with name: ${name}`);
  // concat name with name-inviteCode
  name = `${name}-${inviteCode}`;
  console.log(`===> Server name with invite code: ${name}`);
  if (!name) {
    return res.status(400).json({ error: 'Server name is required' });
  }

  if (!inviteCode) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  // Validate invite code
  if (!inviteCodeManager.validateCode(inviteCode)) {
    return res.status(403).json({ error: 'Invalid invite code' });
  }

  // Check if this is a new server creation
  if (!servers[name] && !inviteCodeManager.canCreateServer(inviteCode)) {
    return res.status(403).json({ error: 'Invite code has reached maximum server limit' });
  }

  // Check access limit
  if (!inviteCodeManager.canAccessServer(inviteCode)) {
    return res.status(403).json({ error: 'Invite code has reached maximum access limit' });
  }


  // Create or get server instance for this name
  if (!servers[name]) {
    console.log(`===> Creating new server instance for name: ${name}`);

    let abiInfo = []; // Default to empty array
    if (abi) {
      if (!chainRpcUrl) {
        return res.status(400).json({ error: 'Chain RPC URL is required when creating a new server' });
      }
      try {
        const parsed = abiParser.parseAndStore(abi);
        abiInfo = parsed.raw; // Get the raw ABI array
        storage.saveServer(name, { chainRpcUrl: chainRpcUrl, abi: abiInfo }); // Persist to storage with RPC URL
        ethereumService.setRpcUrl(name, chainRpcUrl); // Set RPC URL for the server
        inviteCodeManager.addServerToCode(inviteCode, name); // Track server creation with invite code
      } catch (error) {
        return res.status(400).json({ error: `Invalid ABI: ${error.message}` });
      }
    }
    // print abiInfo
    console.log(`===> ABI Info: ${JSON.stringify(abiInfo)}`);
    servers[name] = createMcpServer(name, abiInfo);
  }

  res.json({
    url: `/sse/${name}`,
    messageUrl: `/messages/${name}`
  });
});

// SSE endpoint with name parameter
app.get("/sse/:name", async (req, res) => {
  const { name } = req.params;
  console.log(`===> Received SSE connection request for name: ${name}`);

  if (!servers[name]) {
    console.log(`===> Server instance not found for name: ${name}`);
    return res.status(404).send(`No server found for name ${name}`);
  }

  const transport = new SSEServerTransport(`/messages/${name}`, res);
  transports[name] = transports[name] || {};
  transports[name][transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[name][transport.sessionId];
    if (Object.keys(transports[name]).length === 0) {
      delete transports[name];
    }
  });

  console.log(`Active servers: ${Object.keys(servers).join(', ')}`);
  console.log(`Active transports for ${name}`);

  await servers[name].connect(transport);
});

// Message endpoint with name parameter
app.post("/messages/:name", async (req, res) => {
  const { name } = req.params;
  const sessionId = req.query.sessionId;
  const transport = transports[name]?.[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send(`No transport found for name ${name} and sessionId ${sessionId}`);
  }
});

// Serve static files
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express Server running on port ${PORT}`);
});