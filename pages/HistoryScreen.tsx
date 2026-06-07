import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { BackendAPI } from '../services/backend';
import { useQueryClient } from '@tanstack/react-query';

const HistoryScreen: React.FC = () => {
  const { role: userRole } = useAuth();
  const { transactions } = useData();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'All' | 'Successful' | 'Pending' | 'Failed'>('All');
  const [searchQuery] = useState('');

  // Reversal state
  const [reverseTarget, setReverseTarget] = useState<{ id: string; amount: number; childName: string } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const filteredTransactions = transactions.filter(t => {
    const matchesFilter = filter === 'All' ? true : t.status === filter;
    const matchesSearch = searchQuery.trim() === '' ||
      t.childName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.schoolName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const isSchoolOwner = userRole === 'school_owner';

  const canReverse = (t: typeof transactions[0]) =>
    isSchoolOwner &&
    t.status === 'Successful' &&
    (t.type || '').toUpperCase() === 'INSTALLMENT';

  const handleReverseClick = (t: typeof transactions[0]) => {
    setReverseTarget({ id: t.id, amount: t.amount, childName: t.childName });
    setReverseReason('');
    setReverseError(null);
  };

  const handleReverseConfirm = async () => {
    if (!reverseTarget || reversing) return;
    setReversing(true);
    setReverseError(null);
    try {
      await BackendAPI.school.reversePayment(reverseTarget.id, reverseReason || undefined);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['schoolHistory'] });
      setReverseTarget(null);
    } catch (err: any) {
      setReverseError(err?.response?.data?.message ?? 'Reversal failed. Please try again.');
    } finally {
      setReversing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Successful': return 'text-success bg-success/10';
      case 'Pending': return 'text-warning bg-warning/10';
      case 'Failed': return 'text-danger bg-danger/10';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Successful': return 'bg-success';
      case 'Pending': return 'bg-warning';
      case 'Failed': return 'bg-danger';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Layout showBottomNav>
      <Header title={userRole === 'owner' ? "All Platform Transactions" : isSchoolOwner ? "School Collection History" : "Payment History"} />
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          {['All', 'Successful', 'Pending', 'Failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${
                filter === f
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-white dark:bg-card-dark text-text-secondary-light dark:text-text-secondary-dark border-gray-100 dark:border-gray-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-3 pb-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-20 px-8 bg-gray-50/50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">receipt_long</span>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No matching transactions found</p>
            </div>
          ) : (
            filteredTransactions.map((t) => (
              <div key={t.id} className="group bg-white dark:bg-card-dark p-5 rounded-[28px] border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-xl hover:border-primary/20">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`size-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                      t.status === 'Successful'
                        ? 'bg-success shadow-lg shadow-success/20'
                        : t.status === 'Failed'
                          ? 'bg-danger shadow-lg shadow-danger/20'
                          : 'bg-warning shadow-lg shadow-warning/20'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">
                        {t.status === 'Successful' ? 'payments' : t.status === 'Failed' ? 'error' : 'sync'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-text-primary-light dark:text-text-primary-dark tracking-tight">{t.childName}</h3>
                      <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest mt-0.5">{isSchoolOwner ? "Received Inflow" : t.schoolName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-text-primary-light dark:text-text-primary-dark">₦{t.amount.toLocaleString()}</p>
                    <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest opacity-60">Amount</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">{t.date}</span>
                  <div className="flex items-center gap-2">
                    {canReverse(t) && (
                      <button
                        onClick={() => handleReverseClick(t)}
                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors"
                      >
                        Reverse
                      </button>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${getStatusColor(t.status)} shadow-sm`}>
                      <div className={`size-1.5 rounded-full ${getStatusDot(t.status)} animate-pulse`}></div>
                      {t.status}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />

      {/* Reversal Confirmation Modal */}
      {reverseTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
          <div className="bg-white dark:bg-card-dark rounded-[32px] w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-warning/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-warning text-2xl">undo</span>
              </div>
              <div>
                <h2 className="font-black text-base text-text-primary-light dark:text-text-primary-dark">Reverse Payment</h2>
                <p className="text-xs text-text-secondary-light mt-0.5">
                  ₦{reverseTarget.amount.toLocaleString()} — {reverseTarget.childName}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary-light leading-relaxed">
              This will mark the payment as reversed and restore the student's outstanding balance.
              This action is recorded in the audit log.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
                Reason <span className="opacity-50">(optional)</span>
              </label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g. Payment was made in error"
                rows={2}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-sm text-text-primary-light dark:text-text-primary-dark resize-none focus:outline-none focus:border-warning"
              />
            </div>

            {reverseError && (
              <p className="text-xs text-danger font-bold px-1">{reverseError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setReverseTarget(null); setReverseError(null); }}
                disabled={reversing}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-xs font-black uppercase tracking-widest text-text-secondary-light disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseConfirm}
                disabled={reversing}
                className="flex-1 py-3.5 rounded-2xl bg-warning text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-warning/20 disabled:opacity-50 transition-opacity"
              >
                {reversing ? 'Reversing…' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HistoryScreen;
