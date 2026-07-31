import { describe, it, expect, afterEach, vi } from "vitest";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("always passes warn and error through to the console", async () => {
    const { logger } = await import("./logger");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.warn("w", 1);
    logger.error("e", 2);

    expect(warn).toHaveBeenCalledWith("w", 1);
    expect(error).toHaveBeenCalledWith("e", 2);
  });

  it("emits debug and info while in dev mode", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    const { logger } = await import("./logger");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.debug("d");
    logger.info("i");

    expect(debug).toHaveBeenCalledWith("d");
    expect(info).toHaveBeenCalledWith("i");
  });

  it("silences debug and info outside dev mode", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { logger } = await import("./logger");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.debug("d");
    logger.info("i");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});

describe("redact", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("masks an email to its first/last local character and domain", async () => {
    const { redact } = await import("./logger");
    expect(redact({ email: "ada.lovelace@gmail.com" })).toEqual({
      email: "a***e@gmail.com",
    });
  });

  it("masks a phone number to its last four digits", async () => {
    const { redact } = await import("./logger");
    expect(redact({ phoneNumber: "08012345678" })).toEqual({
      phoneNumber: "***5678",
    });
    expect(redact({ phone: "+2348012345678" })).toEqual({ phone: "***5678" });
  });

  it("drops secrets entirely", async () => {
    const { redact } = await import("./logger");
    expect(
      redact({ password: "hunter2", confirmPassword: "hunter2", token: "t" }),
    ).toEqual({
      password: "[redacted]",
      confirmPassword: "[redacted]",
      token: "[redacted]",
    });
  });

  it("passes diagnostic fields through untouched", async () => {
    const { redact } = await import("./logger");
    expect(redact({ reason: "PHONE_ALREADY_REGISTERED", field: "phoneNumber" })).toEqual(
      { reason: "PHONE_ALREADY_REGISTERED", field: "phoneNumber" },
    );
  });

  it("handles a short local part and a malformed address", async () => {
    const { redact } = await import("./logger");
    expect(redact({ email: "ab@gmail.com" })).toEqual({
      email: "***@gmail.com",
    });
    expect(redact({ email: "nope" })).toEqual({ email: "<malformed>" });
  });

  it("leaves a non-string value under a masked key alone", async () => {
    const { redact } = await import("./logger");
    expect(redact({ email: null, phoneNumber: 42 })).toEqual({
      email: null,
      phoneNumber: 42,
    });
  });
});

describe("logger.event", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("emits one object with a stable shape", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    const { logger, CLIENT_EVENTS } = await import("./logger");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.event(CLIENT_EVENTS.SIGNUP_SUBMITTED, { mode: "signup" });

    expect(info).toHaveBeenCalledTimes(1);
    const entry = info.mock.calls[0][0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      event: "signup.submitted",
      level: "info",
      mode: "signup",
    });
    expect(typeof entry.ts).toBe("string");
  });

  // The browser console is visible in screen shares and support screenshots —
  // an unredacted email there has left our control.
  it("redacts PII before it reaches the console", async () => {
    const { logger, CLIENT_EVENTS } = await import("./logger");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.event(
      CLIENT_EVENTS.SIGNUP_REJECTED,
      {
        email: "ada.lovelace@gmail.com",
        phoneNumber: "08012345678",
        password: "hunter2",
      },
      "warn",
    );

    const serialized = JSON.stringify(warn.mock.calls[0][0]);
    expect(serialized).not.toContain("lovelace");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("8012345678");
    expect(serialized).toContain("a***e@gmail.com");
    expect(serialized).toContain("***5678");
  });

  it("routes a rejection to warn so it survives a production build", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { logger, CLIENT_EVENTS } = await import("./logger");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.event(CLIENT_EVENTS.SIGNUP_REJECTED, { reason: "X" }, "warn");
    logger.event(CLIENT_EVENTS.SIGNUP_SUBMITTED, {});

    expect(warn).toHaveBeenCalledTimes(1);
    // info-level events are dev-only, like logger.info
    expect(info).not.toHaveBeenCalled();
  });

  it("routes an error-level event to console.error", async () => {
    const { logger, CLIENT_EVENTS } = await import("./logger");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.event(CLIENT_EVENTS.SIGNUP_REJECTED, {}, "error");

    expect(error).toHaveBeenCalledTimes(1);
  });

  it("works with no fields", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    const { logger, CLIENT_EVENTS } = await import("./logger");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.event(CLIENT_EVENTS.LOGIN_SUCCEEDED);

    const entry = info.mock.calls[0][0] as Record<string, unknown>;
    expect(entry.event).toBe("login.succeeded");
  });
});
