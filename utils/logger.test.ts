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
