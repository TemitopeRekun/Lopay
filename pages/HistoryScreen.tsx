import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { BackendAPI } from '../services/backend';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../hooks/useQueries';
import { formatDateTime } from '../utils/date';
import type { Transaction } from '../types';

const FILTERS = ['All', 'Successful', 'Pending', 'Failed', 'Reversed'] as const;
type HistoryFilter = (typeof FILTERS)[number];

const HistoryScreen: React.FC = () => {
  const { role: userRole } = useAuth();
  const { transactions } = useData();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<HistoryFilter>('All');
  const [searchQuery] = useState('');

  // The receipt the payer uploaded, opened in a lightbox. The list already fetches
  // `receiptSignedUrl` (`includeReceiptSignedUrls=true`) but never rendered it, so a
  // parent could upload proof of transfer and then had no way to see it back.
  const [receiptPreview, setReceiptPreview] = useState<Transaction | null>(null);

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
      /*
       * A reversal restores a balance, so it moves this list, the school's stats,
       * the roster and the platform-wide ledger.
       *
       * This used to invalidate `['transactions']` and `['schoolHistory']` — and
       * `schoolHistory` is not a key anywhere in the app. The school owner's own
       * history lives under `schoolTransactions`, so the list they were looking at
       * never refetched. It only appeared to work because the server also pushes
       * `payments:changed` over the socket; with the socket down, the row stayed
       * "Successful" until the fallback poll.
       */
      await Promise.all(
        [
          QUERY_KEYS.transactions,
          QUERY_KEYS.schoolTransactions,
          QUERY_KEYS.globalTransactions,
          QUERY_KEYS.schoolStats,
          QUERY_KEYS.schoolStudents,
          QUERY_KEYS.children,
          QUERY_KEYS.notifications,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
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
      case 'Reversed': return 'text-slate-500 bg-slate-500/10';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Successful': return 'bg-success';
      case 'Pending': return 'bg-warning';
      case 'Failed': return 'bg-danger';
      case 'Reversed': return 'bg-slate-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTile = (status: string) => {
    switch (status) {
      case 'Successful': return 'bg-success shadow-lg shadow-success/20';
      case 'Failed': return 'bg-danger shadow-lg shadow-danger/20';
      case 'Reversed': return 'bg-slate-500 shadow-lg shadow-slate-500/20';
      default: return 'bg-warning shadow-lg shadow-warning/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Successful': return 'payments';
      case 'Failed': return 'error';
      case 'Reversed': return 'undo';
      default: return 'sync';
    }
  };

  /** "First payment" / "Installment" — which leg of the plan this row is. */
  const getTypeLabel = (type: string | undefined) => {
    const upper = (type || '').toUpperCase();
    if (upper === 'FIRST_PAYMENT') return 'First payment';
    if (upper === 'INSTALLMENT') return 'Installment';
    return null;
  };

  return (
    <Layout showBottomNav>
      <Header title={userRole === 'owner' ? "All Platform Transactions" : isSchoolOwner ? "School Collection History" : "Payment History"} />
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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
                    <div className={`size-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${getStatusTile(t.status)}`}>
                      <span className="material-symbols-outlined text-2xl">
                        {getStatusIcon(t.status)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-text-primary-light dark:text-text-primary-dark tracking-tight">{t.childName}</h3>
                      <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest mt-0.5">{isSchoolOwner ? "Received Inflow" : t.schoolName}</p>
                      {getTypeLabel(t.type) && (
                        <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest mt-1 opacity-70">
                          {getTypeLabel(t.type)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-text-primary-light dark:text-text-primary-dark">₦{t.amount.toLocaleString()}</p>
                    <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest opacity-60">Amount</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">{formatDateTime(t.date)}</span>
                  <div className="flex items-center gap-2">
                    {t.receiptSignedUrl && (
                      <button
                        onClick={() => setReceiptPreview(t)}
                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        Receipt
                      </button>
                    )}
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

      {/* Receipt preview. The signed URL is short-lived and minted per request, so
          this shows whatever the list last fetched rather than caching it. */}
      {receiptPreview?.receiptSignedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setReceiptPreview(null)}
        >
          <div
            className="bg-white dark:bg-card-dark rounded-[28px] w-full max-w-md p-5 flex flex-col gap-4 shadow-2xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-sm text-text-primary-light dark:text-text-primary-dark">
                  Payment Receipt
                </h2>
                <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest mt-0.5">
                  ₦{receiptPreview.amount.toLocaleString()} — {formatDateTime(receiptPreview.date)}
                </p>
              </div>
              <button
                onClick={() => setReceiptPreview(null)}
                className="size-9 shrink-0 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-text-secondary-light"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <img
              src={receiptPreview.receiptSignedUrl}
              alt={`Receipt for ₦${receiptPreview.amount.toLocaleString()}`}
              className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 object-contain max-h-[60vh] bg-gray-50 dark:bg-black/20"
            />

            <a
              href={receiptPreview.receiptSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest text-center"
            >
              Open full size
            </a>
          </div>
        </div>
      )}

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
