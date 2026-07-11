import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

describe("queryClient (shared app QueryClient)", () => {
  it("is a QueryClient instance", () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it("configures the intended default query options", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 30);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("exposes a working query cache", () => {
    expect(queryClient.getQueryCache()).toBeDefined();
  });
});
