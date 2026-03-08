import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  withScope: vi.fn((fn: (scope: unknown) => void) => {
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    fn(scope);
    return scope;
  }),
}));

import * as Sentry from "@sentry/nextjs";
import { logWarning } from "@/lib/logger";

describe("logWarning", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
    vi.mocked(Sentry.withScope).mockClear();
  });

  it("calls Sentry.captureMessage with warning level", () => {
    logWarning("my-tag", "something went wrong");
    expect(Sentry.captureMessage).toHaveBeenCalledWith("something went wrong", "warning");
  });

  it("sets scope tag and context when context is provided", () => {
    logWarning("my-tag", "msg", { ctx: 1 });
    expect(Sentry.withScope).toHaveBeenCalledOnce();
    const scopeFn = vi.mocked(Sentry.withScope).mock.calls[0][0];
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    scopeFn(scope);
    expect(scope.setTag).toHaveBeenCalledWith("tag", "my-tag");
    expect(scope.setContext).toHaveBeenCalledWith("details", { ctx: 1 });
  });

  it("does not call setContext when context is omitted", () => {
    logWarning("my-tag", "msg");
    const scopeFn = vi.mocked(Sentry.withScope).mock.calls[0][0];
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    scopeFn(scope);
    expect(scope.setContext).not.toHaveBeenCalled();
  });
});
