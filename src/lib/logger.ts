type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => log("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => log("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => log("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => log("error", msg, f),
};
