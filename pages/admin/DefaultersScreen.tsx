import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { getChildBalance } from '../../services/ledger';

/**
 * Defaulted students for a school context.
 *
 * The "Send Reminder" and "Call parent" buttons that used to sit on each row are
 * gone: neither reached the backend. The reminder only raised a success toast
 * (no notification was ever created) and the call handler announced
 * "Simulating call to parent..." with the tel: link commented out. Showing a
 * confirmation for work that never happened is worse than offering no button.
 *
 * A platform admin gets no rows here — `allStudents` is only fetched in a school
 * context (see DataContext), and the school-scoped endpoints are SCHOOL_OWNER
 * only. The banner below says so rather than rendering a misleading
 * "No payments overdue!". Admins are pointed at the collections breakdown, which
 * derives overdue figures from real admin endpoints.
 */
const DefaultersScreen: React.FC = () => {
  const { allStudents } = useData();
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const isPlatformAdmin = userRole === 'owner';
  const defaulters = allStudents.filter(child => child.status === 'Defaulted');

  return (
    <Layout>
      <Header title="Defaulters List" />
      <div className="flex-1 p-6 overflow-y-auto">
        {isPlatformAdmin ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4">
                <span className="material-symbols-outlined text-5xl text-gray-300">insights</span>
                <div>
                    <p className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
                        Platform-wide view lives elsewhere
                    </p>
                    <p className="text-xs text-text-secondary-light mt-2 max-w-xs">
                        This list is scoped to a single school. For overdue figures across
                        every school, open the collections breakdown.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/admin/breakdown', { state: { tab: 'overdue' } })}
                    className="px-5 py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                    Open Collections Breakdown
                </button>
            </div>
        ) : defaulters.length === 0 ? (
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
                                {/*
                                  The enrollment's own remaining balance — the
                                  same number the ledger reduces on each
                                  confirmed payment. `totalFee - paidAmount`
                                  used to stand
                                  in for it and came out short by the platform
                                  fee inside the first payment, since paidAmount
                                  is the gross the parent paid.
                                */}
                                ₦{getChildBalance(child).remaining.toLocaleString()}
                            </span>
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
