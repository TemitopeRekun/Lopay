
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useApp } from '../../context/AppContext';

const DefaultersScreen: React.FC = () => {
  const navigate = useNavigate();
  const { childrenData } = useApp();

  const defaulters = childrenData.filter(child => child.status === 'Defaulted');

  const handleRemind = (childName: string) => {
      alert(`Reminder sent to parents of ${childName}`);
  };

  const handleCall = () => {
      alert("Simulating call to parent...");
      // window.location.href = "tel:1234567890";
  };

  return (
    <Layout>
      <Header title="Defaulters List" />
      <div className="flex-1 p-6 overflow-y-auto">
        {defaulters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                <span className="material-symbols-outlined text-6xl mb-4">check_circle</span>
                <p>No payments overdue!</p>
            </div>
        ) : (
            <div className="flex flex-col gap-4">
                {defaulters.map(child => (
                    <div key={child.id} className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                                <img src={child.avatarUrl} alt={child.name} className="size-10 rounded-full bg-gray-200" />
                                <div>
                                    <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">{child.name}</h3>
                                    <p className="text-sm text-text-secondary-light">{child.school}</p>
                                </div>
                             </div>
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase bg-danger/10 text-danger`}>
                                 {child.status}
                             </span>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                            <span className="text-text-secondary-light">Outstanding</span>
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">
                                ₦{(child.totalFee - child.paidAmount).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex gap-2 mt-1">
                            <button 
                                onClick={() => handleRemind(child.name)}
                                className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-sm active:scale-95 transition-transform"
                            >
                                Send Reminder
                            </button>
                            <button 
                                onClick={handleCall}
                                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">call</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </Layout>
  );
};

export default DefaultersScreen;
