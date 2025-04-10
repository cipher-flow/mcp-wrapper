// Simple logger for Cloudflare Workers environment

// Detect if we're in a Cloudflare Workers environment
const isCloudflareWorker = typeof globalThis.caches !== 'undefined';

// Current log level
let currentLogLevel = 'info';

// Log levels and their priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Add request context to logs
const addRequestContext = (info, context = {}) => {
  return {
    ...info,
    requestId: context.requestId,
    inviteCode: context.inviteCode,
    serverName: context.serverName,
    sessionId: context.sessionId
  };
};

// Format log entry as JSON string
const formatLogEntry = (level, message, context = {}, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logInfo = addRequestContext({ timestamp, level, message, ...meta }, context);
  return JSON.stringify(logInfo);
};

// Check if we should log at this level
const shouldLog = (level) => {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel];
};

// Log to file if in Node.js environment
const logToFile = (_level, _logString) => {
  if (isCloudflareWorker) return; // Skip in Cloudflare Workers

  // In a real implementation, you would write to files here
  // This is intentionally left empty to avoid file system operations
  // Parameters are prefixed with _ to indicate they are intentionally unused
};

// Core logging function
const logWithContext = (level, message, context = {}, meta = {}) => {
  if (!shouldLog(level)) return;

  const logString = formatLogEntry(level, message, context, meta);

  // Log to console
  if (level === 'error') {
    console.error(logString);
  } else if (level === 'warn') {
    console.warn(logString);
  } else {
    console.log(logString);
  }

  // Log to file if in Node.js environment
  logToFile(level, logString);
};

// Create the log object with standard methods
export const log = {
  info: (message, context = {}, meta = {}) => logWithContext('info', message, context, meta),
  warn: (message, context = {}, meta = {}) => logWithContext('warn', message, context, meta),
  error: (message, context = {}, meta = {}) => logWithContext('error', message, context, meta),
  debug: (message, context = {}, meta = {}) => logWithContext('debug', message, context, meta),

  // Initialize logger with environment-specific settings
  init: (env) => {
    if (env?.LOG_LEVEL && LOG_LEVELS[env.LOG_LEVEL] !== undefined) {
      currentLogLevel = env.LOG_LEVEL;
    }

    const environment = isCloudflareWorker ? 'cloudflare-worker' : 'node';
    log.info(`Logger initialized in ${environment} environment`, { logLevel: currentLogLevel });

    return log;
  }
};