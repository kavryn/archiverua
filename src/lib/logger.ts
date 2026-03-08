import * as Sentry from "@sentry/nextjs";

const fmt = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

// Patch once only — guards against double-instantiation in prod bundles
if (!(globalThis as Record<string, unknown>).__loggerPatched) {
  (globalThis as Record<string, unknown>).__loggerPatched = true;
  const { log, error, warn, info } = console;
  console.log   = (...a) => log(`[${fmt()}]`, ...a);
  console.error = (...a) => error(`[${fmt()}]`, ...a);
  console.warn  = (...a) => warn(`[${fmt()}]`, ...a);
  console.info  = (...a) => info(`[${fmt()}]`, ...a);
}

export function logError(tag: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${tag}]`, { message, stack, ...context });

  Sentry.withScope((scope) => {
    scope.setTag("tag", tag);
    if (context) {
      scope.setContext("details", context);
    }
    if (err instanceof Error) {
      Sentry.captureException(err);
    } else {
      Sentry.captureMessage(message, "error");
    }
  });
}

export function logWarning(tag: string, message: string, context?: Record<string, unknown>): void {
  console.warn(`[${tag}]`, { message, ...context });
  Sentry.withScope((scope) => {
    scope.setTag("tag", tag);
    if (context) scope.setContext("details", context);
    Sentry.captureMessage(message, "warning");
  });
}
