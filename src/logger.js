import winston from 'winston';

// Configure the logger with custom format
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add request context to logs
const addRequestContext = (info, context) => {
  return {
    ...info,
    requestId: context.requestId,
    inviteCode: context.inviteCode,
    serverName: context.serverName
  };
};

// Wrapper functions with context support
const logWithContext = (level, message, context = {}, meta = {}) => {
  const logInfo = addRequestContext({ message, ...meta }, context);
  logger.log(level, logInfo);
};

export const log = {
  info: (message, context = {}, meta = {}) => logWithContext('info', message, context, meta),
  warn: (message, context = {}, meta = {}) => logWithContext('warn', message, context, meta),
  error: (message, context = {}, meta = {}) => logWithContext('error', message, context, meta),
  debug: (message, context = {}, meta = {}) => logWithContext('debug', message, context, meta)
};