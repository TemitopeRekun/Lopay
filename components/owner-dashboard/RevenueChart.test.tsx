import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevenueChart } from "./RevenueChart";

const props = {
  chartView: "Monthly" as const,
  onChartViewChange: () => {},
  chartData: [
    { label: "Jun", value: 100000 },
    { label: "Jul", value: 150000 },
  ],
  maxChartValue: 150000,
  onViewLogs: () => {},
};

describe("RevenueChart", () => {
  it("derives growth from the last two buckets instead of hardcoding it", () => {
    render(<RevenueChart {...props} />);
    // 100k → 150k. The old card always claimed "+12.4%".
    expect(screen.getByText("+50.0% vs previous")).toBeInTheDocument();
    expect(screen.queryByText(/12\.4%/)).not.toBeInTheDocument();
  });

  it("reports a decline as negative", () => {
    render(
      <RevenueChart
        {...props}
        chartData={[
          { label: "Jun", value: 200000 },
          { label: "Jul", value: 150000 },
        ]}
      />,
    );
    expect(screen.getByText("-25.0% vs previous")).toBeInTheDocument();
  });

  it("declines to invent a comparison with no usable baseline", () => {
    render(
      <RevenueChart {...props} chartData={[{ label: "Jul", value: 150000 }]} />,
    );
    expect(screen.getByText("No prior period to compare")).toBeInTheDocument();
  });

  it("does not divide by a zero baseline", () => {
    render(
      <RevenueChart
        {...props}
        chartData={[
          { label: "Jun", value: 0 },
          { label: "Jul", value: 150000 },
        ]}
      />,
    );
    expect(screen.getByText("No prior period to compare")).toBeInTheDocument();
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
