import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { ethereumService } from "./ethereum.js";
import { abiParser } from "./abiParser.js";

const app = express();

// Factory function to create configured MCP server instances
function createMcpServer(name) {
  const server = new McpServer({
    name: name || "Echo Server",
    version: "1.0.0"
  });

  // Set up echo resource
  server.resource(
    `echo-${name}`,
    new ResourceTemplate("echo://{message}", { list: undefined }),
    async (uri, { message }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Resource echo: ${message.split("").reverse().join("")}`,
        },
      ],
    })
  );

  // Set up echo tool
  server.tool(
    `echo-${name}`,
    { message: z.string() },
    async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message.split('').reverse().join('')}` }]
    })
  );

  // Set up Ethereum ERC20 balance tool
  server.tool(
    `erc20-balance-${name}`,
    {
      contractAddress: z.string(),
      walletAddress: z.string()
    },
    async ({ contractAddress, walletAddress }) => {
      try {
        const result = await ethereumService.getERC20Balance(contractAddress, walletAddress);
        return {
          content: [{
            type: "text",
            text: `Balance: ${result.balance} ${result.symbol}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message}`
          }]
        };
      }
    }
  );

  // Set up echo prompt
  server.prompt(
    "echo",
    { message: z.string() },
    ({ message }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please process this message: ${message}`
        }
      }]
    })
  );

  return server;
}

// Handle ABI storage
app.post('/store-abi', async (req, res) => {
  try {
    const { abi, id } = req.body;
    if (!abi || !id) {
      return res.status(400).json({ error: 'Both abi and id are required' });
    }

    const abiInfo = abiParser.parseAndStore(abi, id);
    res.json({ success: true, abiInfo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Handle ABI retrieval
app.get('/get-abi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const abiInfo = abiParser.getABI(id);
    res.json({ success: true, abiInfo });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Endpoint to get active servers
app.get('/active-servers', (req, res) => {
  res.json({
    servers: Object.keys(servers)
  });
});

// Store active servers by name
const servers = {};
// Store active SSE transports by name
const transports = {};

// Endpoint to get or create server instance and return connection URL
app.get("/server/:name", (req, res) => {
  const { name } = req.params;
  console.log(`===> Received request for server with name: ${name}`);

  // Create or get server instance for this name
  if (!servers[name]) {
    console.log(`===> Creating new server instance for name: ${name}`);
    servers[name] = createMcpServer(name);
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
  console.log(`MCP Echo Server running on port ${PORT}`);
});