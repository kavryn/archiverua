import * as Sentry from "@sentry/nextjs";

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
