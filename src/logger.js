import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LEVELS = ["debug", "info", "warn", "error"];

function todayLogFile(dir) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(dir, `${date}.log`);
}

/**
 * Creates a logger that writes structured JSON lines to logs/<date>.log
 * in addition to the console, so every bot run leaves an audit trail
 * (required by the "実行ログ保存" feature).
 */
export function createLogger({ dir = "logs" } = {}) {
  async function write(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    const line = JSON.stringify(entry);

    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, Object.keys(meta).length ? meta : "");

    await mkdir(dir, { recursive: true });
    await appendFile(todayLogFile(dir), line + "\n", "utf8");
  }

  const logger = {};
  for (const level of LEVELS) {
    logger[level] = (message, meta) => write(level, message, meta);
  }
  return logger;
}

export const logger = createLogger();
