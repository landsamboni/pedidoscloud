/**
 * Minimal structured logger.
 *
 * Emits one JSON object per line so the Amplify SSR CloudWatch log group can be
 * filtered/queried by field (e.g. `{ $.level = "error" }` or by `event`). No
 * dependencies; pure (only console + process.env + Date), so it is safe in the
 * Node SSR runtime. Levels: debug < info < warn < error. The threshold is
 * LOG_LEVEL (env) or "info" in production / "debug" otherwise.
 *
 * Never pass secrets (passwords, tokens, full connection strings) as context.
 */

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = process.env.LOG_LEVEL as Level | undefined;
  if (env && env in ORDER) return ORDER[env];
  return process.env.NODE_ENV === "production" ? ORDER.info : ORDER.debug;
}

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
}

function emit(level: Level, event: string, context?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return;
  const entry: Record<string, unknown> = { level, event, ts: new Date().toISOString() };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] = value instanceof Error ? serializeError(value) : value;
    }
  }
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => emit("debug", event, context),
  info: (event: string, context?: Record<string, unknown>) => emit("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) => emit("error", event, context),
};
