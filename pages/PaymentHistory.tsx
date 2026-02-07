import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BottomNav } from '../components/BottomNav';

export const PaymentHistory: React.FC = () => {
  const navigate = useNavigate();
  const { transactions } = useApp();
  const [filter, setFilter] = useState<'All' | 'Successful' | 'Pending' | 'Failed'>('All');

  // Debug logging for transaction statuses
  React.useEffect(() => {
    console.log("Current Transactions in PaymentHistory:", transactions.map(t => ({ id: t.id, status: t.status })));
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => filter === 'All' || t.status === filter);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-24">
      <header className="sticky top-0 z-10 flex h-auto w-full flex-col bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm">
        <div className="flex items-center p-4 pb-3 justify-between">
          <button onClick={() => navigate('/dashboard')} className="flex size-9 shrink-0 items-center justify-center text-primary-blue">
            <span className="material-symbols-outlined text-3xl">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Payment History</h1>
          <div className="flex size-9 shrink-0 items-center"></div>
        </div>
      </header>
      
      <main className="flex flex-col gap-4 px-4 pb-8">
        {/* Search */}
        <div className="py-2">
          <label className="flex flex-col min-w-40 h-12 w-full">
            <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-slate-200/50 dark:bg-slate-800">
              <div className="text-slate-500 flex items-center justify-center pl-4 rounded-l-lg border-r-0">
                <span className="material-symbols-outlined text-2xl">search</span>
              </div>
              <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg focus:outline-0 bg-transparent h-full placeholder:text-slate-400 px-4 pl-2 text-base" placeholder="Search by child or school..." />
            </div>
          </label>
        </div>

        {/* Filters */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mr-4 pl-0.5 no-scrollbar">
          {['All', 'Successful', 'Pending', 'Failed'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg pl-4 pr-3 transition-colors ${filter === f ? 'bg-primary-blue text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'}`}
            >
              <p className="text-sm font-medium leading-normal">{f}</p>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl bg-card-light dark:bg-card-dark p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                  <p className="text-base font-semibold leading-normal line-clamp-1">{t.childName}</p>
                  <p className="text-slate-500 text-sm font-normal leading-normal line-clamp-2">{t.schoolName}</p>
                </div>
                <p className="text-base font-semibold leading-normal shrink-0">₦{t.amount.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between gap-4 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-slate-500 text-sm font-normal leading-normal">{t.date}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`size-2 rounded-full ${
                    t.status === 'Successful' ? 'bg-success' : 
                    t.status === 'Pending' ? 'bg-warning' : 'bg-danger'
                  }`}></div>
                  <p className={`text-sm font-medium ${
                    t.status === 'Successful' ? 'text-success' : 
                    t.status === 'Pending' ? 'text-warning' : 'text-danger'
                  }`}>{t.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};
