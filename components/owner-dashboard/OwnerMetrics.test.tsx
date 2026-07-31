import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerMetrics } from "./OwnerMetrics";

const noop = () => {};

const base = {
  displayRevenue: 1234567,
  totalStudents: 42,
  outstandingBalance: 450000,
  overdueBalance: 120000,
  onStudentsClick: noop,
  onOutstandingClick: noop,
  onOverdueClick: noop,
};

describe("OwnerMetrics", () => {
  it("renders full naira, not a rounded 'M' figure", () => {
    render(<OwnerMetrics {...base} />);
    expect(screen.getByText("₦1,234,567")).toBeInTheDocument();
    // The old card divided by 1e6 and fixed to 1dp, so this rendered "₦0.5M".
    expect(screen.getByText("₦450,000")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows arrears and overdue as separate figures", () => {
    render(<OwnerMetrics {...base} />);
    // One conflated "Plan Arrears" number became two: the whole uncollected book
    // and the part that is genuinely late.
    expect(screen.getByText("Plan Arrears")).toBeInTheDocument();
    expect(screen.getByText("All uncollected")).toBeInTheDocument();
    expect(screen.getByText("₦450,000")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Past due now")).toBeInTheDocument();
    expect(screen.getByText("₦120,000")).toBeInTheDocument();
  });

  it("does not flatten a small balance to zero", () => {
    render(
      <OwnerMetrics
        {...base}
        displayRevenue={0}
        totalStudents={0}
        outstandingBalance={7500}
        overdueBalance={0}
      />,
    );
    // Previously "₦0.0M" — indistinguishable from no arrears at all.
    expect(screen.getByText("₦7,500")).toBeInTheDocument();
    expect(screen.getAllByText("₦0").length).toBeGreaterThan(0);
  });

  it("shows a dash rather than a fabricated 0 while a metric is unresolved", () => {
    render(
      <OwnerMetrics
        {...base}
        displayRevenue={undefined}
        totalStudents={undefined}
        outstandingBalance={undefined}
        overdueBalance={undefined}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText("₦0")).not.toBeInTheDocument();
  });

  it("carries no fabricated status badge", () => {
    render(<OwnerMetrics {...base} />);
    expect(screen.queryByText(/active scaling/i)).not.toBeInTheDocument();
  });

  it("drills into each metric's own breakdown", async () => {
    const user = userEvent.setup();
    const onStudentsClick = vi.fn();
    const onOutstandingClick = vi.fn();
    const onOverdueClick = vi.fn();
    render(
      <OwnerMetrics
        {...base}
        onStudentsClick={onStudentsClick}
        onOutstandingClick={onOutstandingClick}
        onOverdueClick={onOverdueClick}
      />,
    );

    await user.click(screen.getByText("₦450,000"));
    expect(onOutstandingClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("₦120,000"));
    expect(onOverdueClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("42"));
    expect(onStudentsClick).toHaveBeenCalledTimes(1);

    // Each card routes to its own tab — no cross-firing.
    expect(onOutstandingClick).toHaveBeenCalledTimes(1);
    expect(onOverdueClick).toHaveBeenCalledTimes(1);
  });
});
