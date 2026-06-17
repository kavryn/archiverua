import { describe, expect, it } from "vitest";
import { toSentryUser } from "@/lib/sentry-user";

describe("toSentryUser", () => {
  it("maps id and username from the session user", () => {
    expect(toSentryUser({ id: 123 as unknown as string, name: "ExampleUser" })).toEqual({
      id: "123",
      username: "ExampleUser",
    });
  });

  it("returns partial data when only one field is available", () => {
    expect(toSentryUser({ id: "42" })).toEqual({ id: "42" });
    expect(toSentryUser({ name: "OnlyName" })).toEqual({ username: "OnlyName" });
  });

  it("returns null when no useful fields are present", () => {
    expect(toSentryUser()).toBeNull();
    expect(toSentryUser(null)).toBeNull();
    expect(toSentryUser({})).toBeNull();
    expect(toSentryUser({ id: null, name: null })).toBeNull();
  });
});
