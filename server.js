import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { ethereumService } from "./ethereum.js";

const app = express();

// Create MCP server instance
const server = new McpServer({
  name: "Echo Server",
  version: "1.0.0"
});

// Set up echo resource
server.resource(
  "echo",
  new ResourceTemplate("echo://{message}", { list: undefined }),
  async (uri, { message }) => ({
    contents: [{
      uri: uri.href,
      text: `Resource echo: ${message.split('').reverse().join('')}`
    }]
  })
);

// Set up echo tool
server.tool(
  "echo",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ type: "text", text: `Tool echo: ${message.split('').reverse().join('')}` }]
  })
);

// Set up Ethereum ERC20 balance tool
server.tool(
  "getERC20Balance",
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

// Store active SSE transports
const transports = {};

// SSE endpoint
app.get("/sse", async (_, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

// Message endpoint
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

// Serve static files
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Echo Server running on port ${PORT}`);
});