// Logger utility for backend

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  info: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Errors are always logged in both dev and production
    console.error(...args);
  },
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  }
};

export default logger;
