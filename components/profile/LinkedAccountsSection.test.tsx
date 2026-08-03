import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkedAccountsSection } from "./LinkedAccountsSection";

const props = {
  isGoogleLinked: false,
  isPasswordEnabled: true,
  isLoading: false,
  onConnectGoogle: vi.fn(),
  isConnecting: false,
  error: null,
};

describe("LinkedAccountsSection", () => {
  it("offers Connect when Google is not linked", () => {
    render(<LinkedAccountsSection {...props} />);
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("shows connected state and no button once linked", () => {
    render(<LinkedAccountsSection {...props} isGoogleLinked />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect/i }),
    ).not.toBeInTheDocument();
  });

  // Offering "Connect" before the answer is known invites a pointless round trip
  // through Google for an account that is already linked.
  it("offers no action while the linked state is unknown", () => {
    render(<LinkedAccountsSection {...props} isLoading />);
    // Both rows read "Checking…" while loading — neither status is known yet.
    expect(screen.getAllByText("Checking…")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /connect/i }),
    ).not.toBeInTheDocument();
  });

  it("invokes the callback on click", async () => {
    const onConnectGoogle = vi.fn();
    render(
      <LinkedAccountsSection {...props} onConnectGoogle={onConnectGoogle} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnectGoogle).toHaveBeenCalledTimes(1);
  });

  it("disables the button while a link is in flight", () => {
    render(<LinkedAccountsSection {...props} isConnecting />);
    expect(screen.getByRole("button", { name: /connecting/i })).toBeDisabled();
  });

  it("renders a failure as an alert so it is announced", () => {
    render(
      <LinkedAccountsSection
        {...props}
        error="That Google account uses a different email address."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "different email address",
    );
  });

  it("shows no alert when there is no error", () => {
    render(<LinkedAccountsSection {...props} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("always shows email & password as an active method", () => {
    render(<LinkedAccountsSection {...props} />);
    expect(screen.getByText(/Email & Password/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
