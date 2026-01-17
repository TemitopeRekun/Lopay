
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Header } from '../components/Header';
import { Layout } from '../components/Layout';

export const ManagePaymentMethods: React.FC = () => {
  const navigate = useNavigate();

  const handleAddMethod = () => {
      // In a real app, this would open a modal or navigate to a form
      const method = window.prompt("Enter new card number (Simulation):", "");
      if (method) {
          alert("Payment method added successfully!");
      }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  return (
    <Layout>
      <Header title="Bank Details" />
      <main className="flex-1 px-4 py-5 overflow-y-auto">
        <p className="mb-6 text-center text-sm text-text-secondary-light px-4">Use the account below for your initial platform activation or when requested for platform settlements.</p>
        
        <div className="space-y-4 rounded-[28px] border border-gray-100 bg-white dark:bg-card-dark p-6 shadow-sm dark:border-gray-800">
          <div className="flex items-center gap-4 border-b border-gray-50 pb-4 dark:border-gray-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <span className="material-symbols-outlined text-2xl text-primary filled">account_balance</span>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-base font-bold leading-tight text-text-primary-light dark:text-text-primary-dark">Lopay Official Account</p>
              <p className="text-[10px] font-bold leading-normal text-text-secondary-light uppercase tracking-widest">Platform Activation Hub</p>
            </div>
          </div>
          <div className="space-y-5 pt-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Account Name</span>
              <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Lopay Technologies</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Bank Name</span>
              <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Moniepoint</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Account Number</span>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-1">
                <span className="text-2xl font-mono font-black tracking-widest text-text-primary-light dark:text-text-primary-dark">9090390581</span>
                <button 
                  className="bg-primary text-white size-10 flex items-center justify-center rounded-xl active:scale-90 transition-transform" 
                  onClick={() => copyToClipboard('9090390581')}
                >
                  <span className="material-symbols-outlined text-lg">content_copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-5 bg-warning/5 rounded-2xl border border-warning/20">
            <div className="flex items-center gap-2 mb-2 text-warning">
                <span className="material-symbols-outlined text-lg">warning</span>
                <span className="text-xs font-black uppercase tracking-widest">Important Note</span>
            </div>
            <p className="text-xs text-text-secondary-light leading-relaxed">Only use this account for the <strong>25% Activation Payment</strong>. All subsequent installment payments (75%) should be paid directly to your school/institution's account as displayed on your dashboard.</p>
        </div>

        <button 
            onClick={handleAddMethod}
            className="mt-8 flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-800 p-5 text-text-secondary-light hover:bg-gray-50 dark:hover:bg-white/5 hover:border-primary/50 hover:text-primary transition-all font-bold text-sm"
        >
            <span className="material-symbols-outlined mr-2">add_card</span>
            Add Local Payment Card
        </button>
      </main>

      <BottomNav />
    </Layout>
  );
};

export default ManagePaymentMethods;
