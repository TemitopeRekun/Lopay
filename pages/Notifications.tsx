import React from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { BottomNav } from "../components/BottomNav";

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { notifications } = useData();

  const getIcon = (type: string) => {
    switch (type) {
      case "payment_success":
        return "task_alt";
      case "payment_due":
        return "notifications";
      case "announcement":
        return "campaign";
      case "payment_failed":
        return "error";
      default:
        return "info";
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case "payment_success":
        return "text-success bg-success/10";
      case "payment_due":
        return "text-warning bg-warning/10";
      case "announcement":
        return "text-primary-blue bg-primary-blue/10";
      case "payment_failed":
        return "text-danger bg-danger/10";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  return (
    <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-background-light dark:bg-background-dark pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-background-light/90 dark:bg-background-dark/90 p-4 pb-3 backdrop-blur-sm">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex size-8 shrink-0 items-center justify-start"
        >
          <span className="material-symbols-outlined text-3xl">
            arrow_back_ios_new
          </span>
        </button>
        <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-tight">
          Notifications
        </h1>
        <div className="flex w-8 shrink-0"></div>
      </header>

      <div className="flex gap-2 p-4">
        <div className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full bg-primary-blue px-4">
          <p className="text-sm font-semibold leading-normal text-white">All</p>
        </div>
        <div className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full bg-slate-200 dark:bg-slate-800 px-4">
          <p className="text-sm font-medium leading-normal">Payments</p>
        </div>
        <div className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full bg-slate-200 dark:bg-slate-800 px-4">
          <p className="text-sm font-medium leading-normal">Announcements</p>
        </div>
      </div>

      <main className="flex flex-col gap-px px-4 pb-4">
        <h2 className="px-2 pb-2 pt-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Recent
        </h2>
        {notifications
          .filter((n) => !n.read)
          .map((n) => (
            <div
              key={n.id}
              className="relative mt-1 flex min-h-[88px] cursor-pointer items-center gap-4 rounded-lg bg-card-light dark:bg-card-dark p-4 shadow-sm"
            >
              <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary-blue"></div>
              <div className="flex items-center gap-4 w-full">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${getColorClass(n.type)}`}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {getIcon(n.type)}
                  </span>
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <p className="text-base font-semibold leading-normal">
                    {n.title}
                  </p>
                  <p className="text-sm font-normal leading-normal text-slate-500">
                    {n.message}
                  </p>
                </div>
              </div>
              <div className="ml-auto shrink-0 self-start pt-1">
                <p className="text-xs font-medium text-slate-500">
                  {n.timestamp}
                </p>
              </div>
            </div>
          ))}

        <h2 className="px-2 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-500">
          Earlier
        </h2>
        {notifications
          .filter((n) => n.read)
          .map((n) => (
            <div
              key={n.id}
              className="mt-1 flex min-h-[88px] cursor-pointer items-center gap-4 rounded-lg bg-card-light dark:bg-card-dark p-4 shadow-sm opacity-80"
            >
              <div className="flex items-center gap-4 w-full">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${getColorClass(n.type)}`}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {getIcon(n.type)}
                  </span>
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <p className="text-base font-semibold leading-normal">
                    {n.title}
                  </p>
                  <p className="text-sm font-normal leading-normal text-slate-500">
                    {n.message}
                  </p>
                </div>
              </div>
              <div className="ml-auto shrink-0 self-start pt-1">
                <p className="text-xs font-medium text-slate-500">
                  {n.timestamp}
                </p>
              </div>
            </div>
          ))}
      </main>
      <BottomNav />
    </div>
  );
};
