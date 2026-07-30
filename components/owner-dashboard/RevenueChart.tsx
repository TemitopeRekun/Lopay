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
}

/** Platform-revenue bar chart with a Weekly/Monthly toggle (controlled). */
export const RevenueChart: React.FC<RevenueChartProps> = ({
  chartView,
  onChartViewChange,
  chartData,
  maxChartValue,
}) => (
  <div className="bg-white dark:bg-card-dark p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm">
    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
          Revenue Insights
        </h3>
        <p className="text-xs text-text-secondary-light font-bold">
          Platform collection trends
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

    <div className="flex items-end justify-between h-48 gap-3 px-1">
      {chartData.map((item, idx) => {
        const heightPercent = (item.value / maxChartValue) * 100;
        return (
          <div
            key={idx}
            className="flex-1 flex flex-col items-center gap-3 h-full justify-end group"
          >
            <div className="relative w-full h-full flex items-end">
              <div
                className="w-full bg-primary/10 group-hover:bg-primary/20 rounded-t-xl transition-all duration-700 ease-out border-b-2 border-primary/40"
                style={{ height: `${heightPercent}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                  ₦{(item.value / 1000).toFixed(0)}k
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

    <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="size-2 rounded-full bg-accent"></div>
        <span className="text-xs font-bold text-text-secondary-light uppercase">
          Growth: +12.4%
        </span>
      </div>
      <span className="text-[9px] font-bold text-primary underline cursor-pointer">
        View Detailed Logs
      </span>
    </div>
  </div>
);
