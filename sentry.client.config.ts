import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  enableLogs: true,
  integrations: (defaultIntegrations) =>
    defaultIntegrations.filter((integration) => integration.name !== "BrowserSession"),
  sendDefaultPii: false,
  tracesSampleRate: 0,
});
