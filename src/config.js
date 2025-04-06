import 'dotenv/config';

const validateEnvVar = (name, defaultValue) => {
  const value = parseInt(process.env[name] || defaultValue);
  if (isNaN(value) || value < 0) {
    throw new Error(`Invalid ${name} configuration`);
  }
  return value;
};

export const config = {
  inviteCode: {
    length: validateEnvVar('INVITE_CODE_LENGTH', 12),
    maxServers: validateEnvVar('INVITE_CODE_MAX_SERVERS', 100),
    maxAccesses: validateEnvVar('INVITE_CODE_MAX_ACCESSES', 1000),
  }
};