import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

export const Calculator: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childData = location.state as any; // Type assertions for quick prototype
  
  // Default if direct access
  const fee = childData?.totalFee || 1500;
  
  // Logic: 12 weeks or 3 months
  const weeklyAmount = fee / 12;
  const monthlyAmount = fee / 3;

  const [selectedPlan, setSelectedPlan] = useState<'Weekly' | 'Monthly'>('Weekly');

  const handleChoose = () => {
    navigate('/confirm', { 
      state: { 
        ...childData, 
        planType: selectedPlan,
        installmentAmount: selectedPlan === 'Weekly' ? weeklyAmount : monthlyAmount
      } 
    });
  };

  return (
    <Layout>
      <div className="flex flex-col flex-1">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-12 shrink-0 items-center text-slate-900 dark:text-slate-100"
          >
            <span className="material-symbols-outlined !text-2xl">
              arrow_back_ios_new
            </span>
          </button>
          <h2 className="text-lg font-bold leading-tight flex-1 text-center pr-12">
            Payment Calculator
          </h2>
        </div>

        <h1 className="text-[32px] font-bold leading-tight px-4 text-left pb-3 pt-6">
          How much is this term's fee?
        </h1>

        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
        <label className="flex flex-col min-w-40 flex-1">
          <p className="text-base font-medium leading-normal pb-2">Total Term Fee</p>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-base font-medium">₦</span>
            <input 
              readOnly 
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border-none bg-slate-200/50 dark:bg-slate-800 h-14 pl-8 pr-4 py-4 text-base font-normal text-slate-500" 
              value={fee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            />
          </div>
        </label>
      </div>
      
      <div className="h-4"></div>
      
      {/* Weekly Plan Card */}
      <div className="p-4 pt-2">
        <div 
          onClick={() => setSelectedPlan('Weekly')}
          className={`flex flex-col items-stretch justify-start rounded-xl border p-4 shadow-sm cursor-pointer transition-all ${selectedPlan === 'Weekly' ? 'border-primary-green bg-primary-green/10 dark:bg-primary-green/20 ring-1 ring-primary-green' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
        >
          <div className="flex w-full min-w-72 grow flex-col items-stretch justify-center gap-1">
            <p className="text-sm font-medium leading-normal">Weekly Plan</p>
            <p className="text-2xl font-bold leading-tight tracking-[-0.015em]">₦{weeklyAmount.toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / week</p>
            <div className="flex items-end gap-3 justify-between mt-1">
              <div className="flex flex-col gap-1">
                <p className="text-slate-500 text-base font-normal leading-normal">Based on a ₦{fee.toLocaleString()} fee</p>
                <p className="text-slate-500 text-base font-normal leading-normal">12 weekly payments</p>
              </div>
              {selectedPlan === 'Weekly' && <span className="material-symbols-outlined text-primary-green filled">check_circle</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Plan Card */}
      <div className="p-4 pt-0">
        <div 
          onClick={() => setSelectedPlan('Monthly')}
          className={`flex flex-col items-stretch justify-start rounded-xl border p-4 shadow-sm cursor-pointer transition-all ${selectedPlan === 'Monthly' ? 'border-primary-green bg-primary-green/10 dark:bg-primary-green/20 ring-1 ring-primary-green' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
        >
          <div className="flex w-full min-w-72 grow flex-col items-stretch justify-center gap-1">
            <p className="text-sm font-medium leading-normal">Monthly Plan</p>
            <p className="text-2xl font-bold leading-tight tracking-[-0.015em]">₦{monthlyAmount.toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / month</p>
            <div className="flex items-end gap-3 justify-between mt-1">
              <div className="flex flex-col gap-1">
                 <p className="text-slate-500 text-base font-normal leading-normal">Based on a ₦{fee.toLocaleString()} fee</p>
                 <p className="text-slate-500 text-base font-normal leading-normal">3 monthly payments</p>
              </div>
              {selectedPlan === 'Monthly' && <span className="material-symbols-outlined text-primary-green filled">check_circle</span>}
            </div>
          </div>
        </div>
      </div>

        <div className="flex items-center justify-center gap-1.5 px-4 pt-2 pb-6 mt-auto">
          <span className="material-symbols-outlined text-sm text-slate-500">
            info
          </span>
          <p className="text-slate-500 text-sm font-medium">
            How is this calculated?
          </p>
        </div>

        <div className="sticky bottom-0 w-full bg-background-light dark:bg-background-dark p-4 pt-2 pb-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleChoose}
            className="flex w-full items-center justify-center rounded-xl bg-primary-green px-6 py-4 text-center text-base font-bold text-slate-900 shadow-sm transition-transform duration-200 ease-in-out hover:scale-[1.02] active:scale-[0.98]"
          >
            Choose a Plan
          </button>
        </div>
      </div>
    </Layout>
  );
};
