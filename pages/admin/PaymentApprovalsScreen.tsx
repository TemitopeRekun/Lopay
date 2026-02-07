import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useApp } from '../../context/AppContext';

const PaymentApprovalsScreen: React.FC = () => {
  const { transactions, approvePayment, declinePayment, userRole } = useApp();
  const navigate = useNavigate();
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const canApprove = userRole === 'owner' || userRole === 'school_owner';
  const pendingTransactions = transactions.filter(t => t.status === 'Pending');

  const handleApprove = (id: string) => {
      approvePayment(id);
  };

  const handleDecline = (id: string) => {
      if (globalThis.confirm("Reject this payment?")) {
          declinePayment(id);
      }
  };

  if (!canApprove) {
      return (
          <Layout>
            <Header title="Access Denied" />
            <div className="flex flex-col items-center justify-center p-10 text-center flex-1">
                <div className="size-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl">lock</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Restricted Action</h2>
                <button onClick={() => navigate(-1)} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">Go Back</button>
            </div>
          </Layout>
      );
  }

  return (
    <Layout>
      <Header title="Payment Approvals" />
      <div className="flex-1 p-6 overflow-y-auto">
        {pendingTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50 pt-20">
                <p>No pending payments to review.</p>
            </div>
        ) : (
            <div className="flex flex-col gap-6">
                {pendingTransactions.map(t => (
                    <div key={t.id} className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                             <div>
                                <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">{t.childName}</h3>
                                <p className="text-xs text-text-secondary-light uppercase font-bold tracking-tight">{t.schoolName}</p>
                             </div>
                             <p className="font-bold text-lg text-primary">₦{t.amount.toLocaleString()}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-bold text-text-secondary-light uppercase">Submitted Receipt</p>
                            <button 
                                onClick={() => setSelectedReceipt(t.receiptUrl || null)}
                                className="w-full aspect-video bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group"
                            >
                                <img src={t.receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined mr-2">zoom_in</span>
                                    <span className="text-xs font-bold uppercase">View Receipt</span>
                                </div>
                            </button>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button onClick={() => handleDecline(t.id)} className="flex-1 py-3 rounded-xl border border-danger/30 text-danger bg-danger/5 font-bold text-xs">Decline</button>
                            <button onClick={() => handleApprove(t.id)} className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-xs">Approve Payment</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-6 items-center justify-center" onClick={() => setSelectedReceipt(null)}>
              <div className="w-full max-w-md bg-white dark:bg-card-dark rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                  <img src={selectedReceipt} alt="Receipt Full" className="w-full h-auto max-h-[70vh] object-contain" />
                  <div className="p-6">
                      <button onClick={() => setSelectedReceipt(null)} className="w-full py-4 bg-primary text-white rounded-xl font-bold">Close Preview</button>
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default PaymentApprovalsScreen;