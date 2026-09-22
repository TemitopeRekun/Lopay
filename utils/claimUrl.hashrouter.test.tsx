import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { CLAIM_TOKEN_PARAM } from "./claimUrl";

/**
 * Does the link the server sends actually reach the claim screen?
 *
 * This is the test whose absence let the feature ship a claim link that went
 * nowhere. Every other test in the suite mocks the router — `useSearchParams`
 * or `useLocation` is stubbed, or the tree is wrapped in `MemoryRouter` with a
 * path handed straight to it — so all of them passed while the URL a parent
 * would actually open matched no route at all.
 *
 * The app mounts `<HashRouter>` (App.tsx), which means the in-app location
 * lives inside the URL fragment. Two plausible link shapes therefore resolve to
 * nothing, and both had been shipped:
 *
 *   - `/claim-invite?token=…`   route in the real path  → no match
 *   - `/claim-invite#token=…`   route in the real path  → no match
 *   - `/#/claim-invite?token=…` route inside the hash   → matches
 *
 * So this mounts the real router against a real `window.location` and asserts
 * the screen is reached and the token arrives. It deliberately does NOT import
 * the claim screen — that would drag in auth, query-client and layout mocks and
 * bury the one thing under test. A stand-in at the same route is enough: what
 * is being proven is that the URL routes and the token is readable, not what
 * the screen renders.
 */

const TOKEN = "Zm9vYmFyLXRva2VuLTEyMzQ1Njc4OTBhYmNkZWZnaGk";

const ClaimStandIn: React.FC = () => {
  const [searchParams] = useSearchParams();
  return (
    <div data-testid="claim-screen">
      <span data-testid="token">{String(searchParams.get(CLAIM_TOKEN_PARAM))}</span>
    </div>
  );
};

const mountAt = (href: string) => {
  window.history.replaceState({}, "", href);
  render(
    <HashRouter>
      <Routes>
        <Route path="/claim-invite" element={<ClaimStandIn />} />
        <Route path="*" element={<div data-testid="no-match">no match</div>} />
      </Routes>
    </HashRouter>,
  );
};

describe("the claim link, through a real HashRouter", () => {
  it("reaches the claim screen with the token", () => {
    mountAt(`/#/claim-invite?token=${TOKEN}`);

    expect(screen.getByTestId("claim-screen")).toBeInTheDocument();
    expect(screen.getByTestId("token")).toHaveTextContent(TOKEN);
  });

  it("carries a token with URL-significant characters intact", () => {
    mountAt("/#/claim-invite?token=a%26b%3Dc+d");

    expect(screen.getByTestId("token")).toHaveTextContent("a&b=c d");
  });

  it.each([
    ["the route in the real path with a query", `/claim-invite?token=${TOKEN}`],
    ["the route in the real path with a fragment", `/claim-invite#token=${TOKEN}`],
  ])("does NOT reach the claim screen from %s", (_label, href) => {
    // Both of these were shipped. Each looks like a working link and resolves
    // to a blank screen, because the router only ever reads the fragment.
    mountAt(href);

    expect(screen.getByTestId("no-match")).toBeInTheDocument();
    expect(screen.queryByTestId("claim-screen")).not.toBeInTheDocument();
  });

  it("keeps the token out of everything the browser transmits", () => {
    mountAt(`/#/claim-invite?token=${TOKEN}`);

    // The request line is path + query. The fragment is stripped before the
    // request is made, and stripped from `Referer` too.
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toContain(TOKEN);
  });
});
