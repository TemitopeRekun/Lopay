import { describe, it, expect } from "vitest";
import versionInfo from "@/version.json";
import {
  APP_VERSION,
  APP_BUILD,
  APP_VERSION_LABEL,
  APP_BUILD_LABEL,
} from "./version";

describe("app version", () => {
  it("reports the version from version.json, the single source of truth", () => {
    expect(APP_VERSION).toBe(versionInfo.name);
    expect(APP_BUILD).toBe(versionInfo.code);
  });

  it("holds a valid semver name and a positive integer build code", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(APP_BUILD)).toBe(true);
    expect(APP_BUILD).toBeGreaterThan(0);
  });

  it("labels the build the way support asks users to read it back", () => {
    expect(APP_VERSION_LABEL).toBe(`${versionInfo.name} (build ${versionInfo.code})`);
  });

  it("omits the commit when the bundle was not built by a deploy", () => {
    // No VITE_COMMIT_REF under vitest, so there is no deploy to name.
    expect(APP_BUILD_LABEL).toBe(APP_VERSION_LABEL);
  });
});
