import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

const MAXIMUM_MESSAGE_SIZE = 4 * 1024 * 1024; // 4MB

/**
 * This transport is compatible with Cloudflare Workers and other edge environments
 */
export class SSEEdgeTransport {
  #controller = null;
  #stream;
  #closed = false;

  onclose;
  onerror;
  onmessage;

  /**
   * Creates a new SSEEdgeTransport, which will direct the MPC client to POST messages to messageUrl
   * @param {string} messageUrl - The URL where clients should POST messages
   * @param {string} sessionId - The session ID for this connection
   */
  constructor(messageUrl, sessionId) {
    this.messageUrl = messageUrl;
    this.sessionId = sessionId;

    // Create a readable stream for SSE
    this.#stream = new ReadableStream({
      start: (controller) => {
        this.#controller = controller;
      },
      cancel: () => {
        this.#closed = true;
        this.onclose?.();
      },
    });
  }

  /**
   * Start the transport
   */
  async start() {
    if (this.#closed) {
      throw new Error(
        'SSE transport already closed! If using Server class, note that connect() calls start() automatically.',
      );
    }

    // Make sure the controller exists
    if (!this.#controller) {
      throw new Error('Stream controller not initialized');
    }

    // Send the endpoint event
    const endpointMessage = `event: endpoint\ndata: ${encodeURI(this.messageUrl)}?sessionId=${this.sessionId}\n\n`;
    this.#controller.enqueue(new TextEncoder().encode(endpointMessage));
  }

  /**
   * Get the SSE response
   */
  get sseResponse() {
    // Ensure the stream is properly initialized
    if (!this.#stream) {
      throw new Error('Stream not initialized');
    }

    // Return a response with the SSE stream
    return new Response(this.#stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }

  /**
   * Handles incoming Requests
   * @param {Request} req - The HTTP request
   */
  async handlePostMessage(req) {
    if (this.#closed || !this.#controller) {
      const message = 'SSE connection not established';
      return new Response(message, { status: 500 });
    }

    try {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Unsupported content-type: ${contentType}`);
      }

      // Check if the request body is too large
      const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
      if (contentLength > MAXIMUM_MESSAGE_SIZE) {
        throw new Error(`Request body too large: ${contentLength} bytes`);
      }

      // Clone the request before reading the body to avoid stream issues
      const body = await req.json();
      await this.handleMessage(body);
      return new Response('Accepted', { status: 202 });
    } catch (error) {
      this.onerror?.(error);
      return new Response(String(error), { status: 400 });
    }
  }

  /**
   * Handle a client message, regardless of how it arrived.
   * @param {unknown} message - The message to handle
   */
  async handleMessage(message) {
    let parsedMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }

    this.onmessage?.(parsedMessage);
  }

  /**
   * Close the transport
   */
  async close() {
    if (!this.#closed && this.#controller) {
      this.#controller.close();
      this.#stream.cancel();
      this.#closed = true;
      this.onclose?.();
    }
  }

  /**
   * Send a message to the client
   * @param {object} message - The message to send
   */
  async send(message) {
    if (this.#closed || !this.#controller) {
      throw new Error('Not connected');
    }

    const messageText = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    this.#controller.enqueue(new TextEncoder().encode(messageText));
  }
}
