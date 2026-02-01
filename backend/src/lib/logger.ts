/**
 * Simple logger utility for production-safe logging.
 * - info: Only logs in development
 * - warn: Always logs (important warnings)
 * - error: Always logs (errors)
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[INFO] ${msg}`, ...args);
    }
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  },
};
