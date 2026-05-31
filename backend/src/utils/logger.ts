import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'body.password',
  'body.token'
];

export const logger = pino({
  level: logLevel,
  redact: redactPaths,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
