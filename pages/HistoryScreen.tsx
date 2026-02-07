
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { useApp } from '../context/AppContext';

const HistoryScreen: React.FC = () => {
  const { transactions, userRole } = useApp();
  const [filter, setFilter] = useState<'All' | 'Successful' | 'Pending' | 'Failed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = transactions.filter(t => {
      const matchesFilter = filter === 'All' ? true : t.status === filter;
      const matchesSearch = searchQuery.trim() === '' || 
          t.childName.toLowerCase().includes(searchQuery.toLowerCase()) || 
          t.schoolName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
  });
  const isSchoolOwner = userRole === 'school_owner';

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Successful': return 'text-success bg-success/10';
          case 'Pending': return 'text-warning bg-warning/10';
          case 'Failed': return 'text-danger bg-danger/10';
          default: return 'text-gray-500 bg-gray-100';
      }
  };

  const getStatusDot = (status: string) => {
      switch(status) {
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
                                <div className={`size-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${t.status === 'Successful' ? 'bg-success shadow-lg shadow-success/20' : 'bg-warning shadow-lg shadow-warning/20'}`}>
                                    <span className="material-symbols-outlined text-2xl">{t.status === 'Successful' ? 'payments' : 'sync'}</span>
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
                             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${getStatusColor(t.status)} shadow-sm`}>
                                 <div className={`size-1.5 rounded-full ${getStatusDot(t.status)} animate-pulse`}></div>
                                 {t.status}
                             </div>
                         </div>
                     </div>
                 ))
             )}
         </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default HistoryScreen;
