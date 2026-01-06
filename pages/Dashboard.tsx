
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { useApp } from '../context/AppContext';

const Dashboard: React.FC = () => {
  const { childrenData, currentUser, transactions, isOwnerAccount, userRole, setActingRole, deleteChild } = useApp();
  const navigate = useNavigate();

  const isStudent = userRole === 'university_student';
  const entityType = isStudent ? "Institution" : "School";

  const totalNextDue = childrenData.reduce((acc, child) => {
      if (child.status === 'Completed') return acc;
      return acc + child.nextInstallmentAmount;
  }, 0);

  const handleQuickPay = (childId: string, amount: number) => {
    navigate('/payment-methods', {
        state: {
            paymentType: 'installment',
            amount: amount,
            childId: childId
        }
    });
  };

  const handleReturnToAdmin = () => {
      setActingRole('owner');
      navigate('/owner-dashboard');
  };

  const handleDeleteChild = (childId: string, childName: string) => {
      const msg = isStudent 
        ? `Are you sure you want to remove your tuition plan? This will delete your payment history.`
        : `Are you sure you want to remove the plan for ${childName}? This will delete their payment history.`;
      
      if (window.confirm(msg)) {
          deleteChild(childId);
      }
  };

  const hasPlans = childrenData.length > 0;

  return (
    <Layout showBottomNav>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-2 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
            {isStudent ? 'My Tuition' : 'Dashboard'}
        </h1>
        <div className="flex items-center gap-3">
             <button 
                onClick={() => navigate('/calendar')}
                className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
                <span className="material-symbols-outlined text-xl text-text-secondary-light">calendar_month</span>
            </button>
            <button onClick={() => navigate('/profile')} className="size-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-sm">
               <img 
                 src={`https://ui-avatars.com/api/?name=${currentUser?.name || 'User'}&background=random`} 
                 alt="Profile" 
                 className="w-full h-full object-cover" 
               />
            </button>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-6">
        {!hasPlans ? (
            <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in-up">
                <div className="w-48 h-48 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 relative overflow-hidden">
                     <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse"></div>
                     <span className="material-symbols-outlined text-8xl text-primary opacity-80">
                        {isStudent ? 'school' : 'family_restroom'}
                     </span>
                </div>
                <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                    Welcome, {currentUser?.name.split(' ')[0]}!
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-xs mb-8">
                    {isStudent 
                        ? "You haven't set up any tuition plans yet. Split your semester or session fees into installments."
                        : "Your dashboard is empty. Add a child and set up a payment plan to get started."}
                </p>
                <button 
                    onClick={() => navigate('/add-child')}
                    className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    {isStudent ? 'Setup Tuition Plan' : 'Start a New Plan'}
                </button>
            </div>
        ) : (
            <>
                <div className="flex flex-col items-stretch justify-start rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                        {isStudent ? 'Upcoming Payments' : 'Upcoming Collections'}
                    </p>
                    <p className="text-4xl font-extrabold tracking-tight mb-2">₦{totalNextDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <div className="flex items-center gap-2 mt-2">
                         <div className="size-2 rounded-full bg-accent animate-pulse"></div>
                         <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">Direct Settlement Active</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider">
                        {isStudent ? 'Active Academic Plans' : 'Plan Status'}
                    </h2>
                </div>

                {childrenData.map((child) => {
                    const progress = Math.min((child.paidAmount / child.totalFee) * 100, 100);
                    const isDueSoon = child.status === 'Due Soon';
                    const isCompleted = child.status === 'Completed';
                    const isOverdue = child.status === 'Overdue';
                    const isPending = transactions.some(t => t.childId === child.id && t.status === 'Pending');
                    
                    const isActivating = child.paidAmount === 0 && isPending;
                    const isFullyInactive = child.paidAmount === 0 && !isPending;

                    let statusColor = 'bg-secondary/10 text-secondary';
                    if (isDueSoon) statusColor = 'bg-warning/10 text-warning';
                    if (isOverdue) statusColor = 'bg-danger/10 text-danger';
                    if (isCompleted) statusColor = 'bg-success/10 text-success';
                    if (isPending && !isCompleted) statusColor = 'bg-primary/10 text-primary';
                    if (isFullyInactive) statusColor = 'bg-gray-100 text-gray-500';

                    let progressColor = 'bg-secondary';
                    if (isDueSoon) progressColor = 'bg-warning';
                    if (isOverdue) progressColor = 'bg-danger';
                    if (isCompleted) progressColor = 'bg-success';

                    return (
                    <div key={child.id} className="flex flex-col rounded-2xl bg-white dark:bg-card-dark shadow-sm border border-gray-100 dark:border-gray-800 p-0 overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between p-4 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src={child.avatarUrl} alt={child.name} className="size-12 rounded-full object-cover bg-gray-100 ring-2 ring-gray-50 dark:ring-gray-800" />
                                {isActivating && (
                                    <div className="absolute -bottom-1 -right-1 size-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-xs text-primary animate-spin">sync</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-text-primary-light dark:text-text-primary-dark">
                                    {child.grade}
                                </p>
                                <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">{child.school}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                {isActivating ? 'Verifying Activation' : isFullyInactive ? 'Not Active' : isCompleted ? 'Completed' : isPending ? 'Processing' : child.status}
                            </div>
                            <button 
                                onClick={() => handleDeleteChild(child.id, child.name)}
                                className="size-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                        </div>

                        <div className="px-4 py-2">
                            <div className="flex justify-between items-end mb-1.5">
                                <span className="text-[10px] text-text-secondary-light font-bold uppercase">
                                    Installments Paid
                                </span>
                                <span className="text-xs font-bold dark:text-white">
                                    <span className={isCompleted ? 'text-success' : 'text-primary'}>₦{child.paidAmount.toLocaleString()}</span> <span className="text-text-secondary-light font-normal text-[10px]">/ ₦{child.totalFee.toLocaleString()}</span>
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`} 
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="mt-2 p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            {isCompleted ? (
                                <div className="w-full flex items-center justify-center text-success font-bold gap-2 text-sm">
                                    <span className="material-symbols-outlined filled text-lg">verified</span>
                                    <span>Tuition Fully Settled</span>
                                </div>
                            ) : isPending ? (
                                <div className="w-full flex items-center justify-center text-primary font-bold gap-2 text-sm">
                                    <span className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                                    <span>{isActivating ? 'Verifying Activation...' : 'Awaiting Confirmation...'}</span>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">
                                            {child.paidAmount === 0 ? 'Activation Required' : 'Next Payment'}
                                        </p>
                                        <p className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark">
                                            ₦{child.nextInstallmentAmount.toLocaleString()} 
                                            <span className="text-[10px] font-normal opacity-70 ml-1">
                                                {child.paidAmount === 0 ? 'Plan Lock' : `due ${child.nextDueDate}`}
                                            </span>
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleQuickPay(child.id, child.nextInstallmentAmount)}
                                        className={`${child.paidAmount === 0 ? 'bg-primary' : 'bg-success'} text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all hover:opacity-90 flex items-center gap-2`}
                                    >
                                        {child.paidAmount === 0 ? (
                                            <>
                                                <span className="material-symbols-outlined text-sm">lock_open</span>
                                                Pay Activation
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm">account_balance</span>
                                                Pay {entityType}
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    );
                })}
                </div>
            </>
        )}
      </main>

      <div className="fixed bottom-24 right-4 z-20 flex flex-col gap-3">
          <button 
            onClick={() => navigate('/support')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-card-dark text-primary shadow-lg border border-gray-100 dark:border-gray-800 hover:scale-105 transition-transform"
          >
              <span className="material-symbols-outlined">help_outline</span>
          </button>
          <button 
                onClick={() => navigate('/add-child')}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-110 transition-transform ring-4 ring-white dark:ring-background-dark"
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
      </div>
      
      {isOwnerAccount && (
        <button
          onClick={handleReturnToAdmin}
          className="fixed bottom-24 left-4 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
          <span className="text-xs uppercase tracking-wide">Back to Admin</span>
        </button>
      )}

      <BottomNav />
    </Layout>
  );
};

export default Dashboard;
