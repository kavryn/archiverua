import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const consoleLoggingIntegration = vi.fn(() => ({ name: "ConsoleLogs" }));

vi.mock("@sentry/nextjs", () => ({
  init,
  consoleLoggingIntegration,
}));

describe("sentry.client.config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/123456");
  });

  it("keeps browser sessions and console log capture enabled", async () => {
    await import("../sentry.client.config");

    expect(init).toHaveBeenCalledOnce();
    const options = init.mock.calls[0][0];
    expect(options.enableLogs).toBe(true);

    const defaultIntegrations = [{ name: "BrowserSession" }, { name: "InboundFilters" }];
    const configuredIntegrations = options.integrations(defaultIntegrations);

    expect(consoleLoggingIntegration).toHaveBeenCalledWith({
      levels: ["log", "info", "warn", "error"],
    });
    expect(configuredIntegrations).toEqual([
      { name: "BrowserSession" },
      { name: "InboundFilters" },
      { name: "ConsoleLogs" },
    ]);
  });

  it("drops dev noise and successful wikiFetch logs before sending", async () => {
    await import("../sentry.client.config");

    const options = init.mock.calls[0][0];

    expect(options.beforeSendLog({ message: "[Fast Refresh] rebuilding" })).toBeNull();
    expect(options.beforeSendLog({ message: "[HMR] connected" })).toBeNull();
//     expect(options.beforeSendLog({ message: "[wikiFetch] POST https://commons.wikimedia.org/w/api.php?crossorigin=1" })).toBeNull();
//     expect(options.beforeSendLog({ message: "[wikiFetch] POST https://commons.wikimedia.org/w/api.php?crossorigin=1 -> 200" })).toBeNull();
    expect(options.beforeSendLog({ message: "[wikiFetch] POST https://commons.wikimedia.org/w/api.php?crossorigin=1 -> 503" })).toEqual({
      message: "[wikiFetch] POST https://commons.wikimedia.org/w/api.php?crossorigin=1 -> 503",
    });

    const appLog = { message: "[uploadFile] API error" };
    expect(options.beforeSendLog(appLog)).toBe(appLog);
  });
});
