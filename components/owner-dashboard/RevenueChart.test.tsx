import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevenueChart } from "./RevenueChart";

/**
 * The last bucket is always the period IN PROGRESS — the series runs up to now.
 * So a like-for-like comparison uses the two closed buckets behind it, and these
 * fixtures carry a trailing partial period to make that explicit.
 */
const props = {
  chartView: "Monthly" as const,
  onChartViewChange: () => {},
  chartData: [
    { label: "May", value: 100000 },
    { label: "Jun", value: 150000 },
    { label: "Jul", value: 20000 }, // current month, part-way through
  ],
  maxChartValue: 150000,
  onViewLogs: () => {},
};

describe("RevenueChart", () => {
  it("compares the last two COMPLETE periods, ignoring the one in progress", () => {
    render(<RevenueChart {...props} />);
    // 100k → 150k across the two closed months. Comparing the part-way-through
    // 20k against 150k would have reported -86.7% every month until it closed.
    expect(screen.getByText("+50.0% last full month")).toBeInTheDocument();
    expect(screen.queryByText(/12\.4%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-86/)).not.toBeInTheDocument();
  });

  it("reports a decline as negative", () => {
    render(
      <RevenueChart
        {...props}
        chartData={[
          { label: "May", value: 200000 },
          { label: "Jun", value: 150000 },
          { label: "Jul", value: 10000 },
        ]}
      />,
    );
    expect(screen.getByText("-25.0% last full month")).toBeInTheDocument();
  });

  it("names the cadence it is comparing", () => {
    render(<RevenueChart {...props} chartView="Weekly" />);
    expect(screen.getByText("+50.0% last full week")).toBeInTheDocument();
  });

  it("declines to invent a comparison with only one closed period", () => {
    render(
      <RevenueChart
        {...props}
        chartData={[
          { label: "Jun", value: 150000 },
          { label: "Jul", value: 20000 },
        ]}
      />,
    );
    expect(
      screen.getByText("No completed month to compare"),
    ).toBeInTheDocument();
  });

  it("does not divide by a zero baseline", () => {
    render(
      <RevenueChart
        {...props}
        chartData={[
          { label: "May", value: 0 },
          { label: "Jun", value: 150000 },
          { label: "Jul", value: 20000 },
        ]}
      />,
    );
    expect(
      screen.getByText("No completed month to compare"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it("shows an empty state rather than a flat chart when there is no revenue", () => {
    render(<RevenueChart {...props} chartData={[]} maxChartValue={1} />);
    expect(
      screen.getByText("No revenue recorded in this period"),
    ).toBeInTheDocument();
  });

  it("labels the range it is actually showing", () => {
    const { rerender } = render(<RevenueChart {...props} />);
    expect(
      screen.getByText("Confirmed platform fees per month"),
    ).toBeInTheDocument();
    rerender(<RevenueChart {...props} chartView="Weekly" />);
    expect(
      screen.getByText("Confirmed platform fees per week"),
    ).toBeInTheDocument();
  });

  it("asks the parent to refetch when the range toggle is used", async () => {
    const user = userEvent.setup();
    const onChartViewChange = vi.fn();
    render(<RevenueChart {...props} onChartViewChange={onChartViewChange} />);
    await user.click(screen.getByText("Weekly"));
    expect(onChartViewChange).toHaveBeenCalledWith("Weekly");
  });

  it("wires the detailed-logs link that used to be a dead span", async () => {
    const user = userEvent.setup();
    const onViewLogs = vi.fn();
    render(<RevenueChart {...props} onViewLogs={onViewLogs} />);
    await user.click(screen.getByText("View Detailed Logs"));
    expect(onViewLogs).toHaveBeenCalledTimes(1);
  });
});
