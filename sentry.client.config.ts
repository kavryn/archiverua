import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  enableLogs: true,
  integrations: (defaultIntegrations) => [
    ...defaultIntegrations,
    Sentry.consoleLoggingIntegration({
      levels: ["log", "info", "warn", "error"],
    }),
  ],
  beforeSendLog(log) {
    const message = String(log.message ?? "");
    if (message.startsWith("[Fast Refresh]") || message.startsWith("[HMR]")) {
      return null;
    }
    if (message.startsWith("[wikiFetch]")) {
      const statusMatch = message.match(/->\s(\d{3})$/);
      if (!statusMatch) {
        return null;
      }
      const status = Number(statusMatch[1]);
      if (status < 400) {
        return null;
      }
    }
    return log;
  },
  sendDefaultPii: false,
  tracesSampleRate: 0,
});
