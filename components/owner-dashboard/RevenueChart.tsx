import React from "react";

export type ChartView = "Weekly" | "Monthly";
export interface ChartPoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  chartView: ChartView;
  onChartViewChange: (view: ChartView) => void;
  chartData: ChartPoint[];
  maxChartValue: number;
  onViewLogs: () => void;
}

const formatNaira = (value: number) =>
  `₦${Math.round(value).toLocaleString("en-NG")}`;

/**
 * Platform-revenue bar chart. The series is whatever `/admin/overview` returned
 * for the selected range — nothing is re-derived or extrapolated client-side.
 */
export const RevenueChart: React.FC<RevenueChartProps> = ({
  chartView,
  onChartViewChange,
  chartData,
  maxChartValue,
  onViewLogs,
}) => {
  // Period-over-period change from the two most recent buckets. Shown only when
  // both exist and the baseline is non-zero; the old card hardcoded "+12.4%".
  const previous = chartData[chartData.length - 2]?.value;
  const latest = chartData[chartData.length - 1]?.value;
  const growthPercent =
    typeof previous === "number" && typeof latest === "number" && previous > 0
      ? ((latest - previous) / previous) * 100
      : undefined;

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
            Revenue Insights
          </h3>
          <p className="text-xs text-text-secondary-light font-bold">
            Confirmed platform fees per {chartView === "Weekly" ? "week" : "month"}
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => onChartViewChange("Weekly")}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartView === "Weekly" ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-text-secondary-light"}`}
          >
            Weekly
          </button>
          <button
            onClick={() => onChartViewChange("Monthly")}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartView === "Monthly" ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-text-secondary-light"}`}
          >
            Monthly
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
          <span className="material-symbols-outlined text-3xl text-gray-300">
            bar_chart
          </span>
          <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
            No revenue recorded in this period
          </p>
        </div>
      ) : (
        <div className="flex items-end justify-between h-48 gap-3 px-1">
          {chartData.map((item, idx) => {
            const heightPercent = (item.value / maxChartValue) * 100;
            return (
              <div
                key={`${item.label}-${idx}`}
                className="flex-1 flex flex-col items-center gap-3 h-full justify-end group"
              >
                <div className="relative w-full h-full flex items-end">
                  <div
                    className="w-full bg-primary/10 group-hover:bg-primary/20 rounded-t-xl transition-all duration-700 ease-out border-b-2 border-primary/40"
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                      {formatNaira(item.value)}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-tighter">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
        {typeof growthPercent === "number" ? (
          <div className="flex items-center gap-2">
            <div
              className={`size-2 rounded-full ${growthPercent >= 0 ? "bg-accent" : "bg-danger"}`}
            />
            <span className="text-xs font-bold text-text-secondary-light uppercase">
              {growthPercent >= 0 ? "+" : ""}
              {growthPercent.toFixed(1)}% vs previous
            </span>
          </div>
        ) : (
          <span className="text-xs font-bold text-text-secondary-light uppercase">
            No prior period to compare
          </span>
        )}
        <button
          type="button"
          onClick={onViewLogs}
          className="text-[9px] font-bold text-primary underline"
        >
          View Detailed Logs
        </button>
      </div>
    </div>
  );
};
