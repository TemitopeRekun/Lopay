
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { PaymentPlan } from '../types';
import { useApp } from '../context/AppContext';

interface LocationState {
    childName: string;
    schoolName: string;
    grade: string;
    totalFee: number;
    plan: PaymentPlan;
    depositAmount: number;
    feeType: 'Semester' | 'Session';
}

const ConfirmPlanScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addChild, addTransaction, userRole } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const state = location.state as LocationState;

  if (!state) return null;

  const { childName, schoolName, grade, totalFee, plan, depositAmount, feeType } = state;
  const isStudent = userRole === 'university_student';
  const entityType = isStudent ? "Institution" : "School";
  
  // Platform Fee is 2.5% of the total tuition
  const platformFee = totalFee * 0.025;
  
  // Initial Payment to activate = 25% Deposit + 2.5% Platform Fee
  const initialActivationPayment = depositAmount + platformFee;
  
  // Standard installment amount for later (remaining 75% / plan length)
  const futureInstallmentAmount = (totalFee * 0.75) / plan.numberOfPayments;

  const monthsDuration = feeType === 'Session' ? 7 : 3;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Account number copied!");
  };

  const handleConfirm = () => {
      setIsProcessing(true);
      const childId = Date.now().toString();

      setTimeout(() => {
          addChild({
              id: childId,
              name: childName,
              school: schoolName,
              grade: grade,
              totalFee: totalFee, 
              paidAmount: 0,
              nextInstallmentAmount: futureInstallmentAmount,
              nextDueDate: 'After Activation',
              status: 'On Track',
              avatarUrl: `https://ui-avatars.com/api/?name=${childName.replace(' ','+')}&background=random`
          });

          addTransaction({
              id: `tx-activation-${Date.now()}`,
              childId: childId,
              childName: childName,
              schoolName: schoolName,
              amount: initialActivationPayment,
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              status: 'Pending'
          });

          navigate('/dashboard');
      }, 2000);
  };

  return (
    <Layout>
       <Header title="Finalize & Activate" />
       
       <div className="flex-1 p-6 overflow-y-auto pb-40">
          {/* Header Summary */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
              <div className="h-14 w-14 rounded-full overflow-hidden shadow-inner shrink-0">
                  <img src={`https://ui-avatars.com/api/?name=${childName.replace(' ','+')}&background=random`} alt="user" className="w-full h-full object-cover" />
              </div>
              <div className="overflow-hidden">
                  <h3 className="text-lg font-bold leading-tight truncate">{childName}</h3>
                  <p className="text-[10px] font-bold uppercase text-text-secondary-light truncate">{grade} • {schoolName}</p>
              </div>
          </div>

          <section className="mb-8">
            <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider mb-4 px-1">Activation Details</h3>
            <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl relative overflow-hidden mb-4 border border-white/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-sm filled">verified</span>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Activation Payment</p>
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter mb-4">₦{initialActivationPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                    
                    {/* Bank Details Card */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Bank Name</span>
                            <span className="text-xs font-bold">Moniepoint</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Account Name</span>
                            <span className="text-xs font-bold">Lopay Technologies</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Account Number</span>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-mono font-black tracking-widest">9090390581</span>
                                <button 
                                    onClick={() => copyToClipboard('9090390581')}
                                    className="bg-primary text-white p-1.5 rounded-lg active:scale-90 transition-transform"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-[9px] text-slate-400 leading-relaxed font-medium italic text-center">Transfer the exact amount above to activate your plan.</p>
                </div>
            </div>
          </section>

          <section className="mb-6">
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4 px-1">Future Roadmap</h3>
              <div className="bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                      {entityType} Installment Details
                  </h3>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-text-secondary-light">Installment Amount</span>
                          <span className="font-bold">₦{futureInstallmentAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {plan.frequencyLabel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm text-text-secondary-light">Plan Duration</span>
                          <span className="font-bold">{monthsDuration} Months</span>
                      </div>
                  </div>
                  <div className="mt-4 p-3 bg-primary/5 rounded-xl flex items-start gap-2 border border-primary/10">
                    <span className="material-symbols-outlined text-sm text-primary">info</span>
                    <p className="text-[10px] font-bold text-primary-dark dark:text-primary leading-snug uppercase tracking-tight">After activation, all remaining payments are made directly to the {entityType.toLowerCase()}'s verified bank details.</p>
                  </div>
              </div>
          </section>
       </div>

       <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800 z-20 pb-safe">
           <button 
             onClick={handleConfirm}
             disabled={isProcessing}
             className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
           >
               {isProcessing ? (
                   <div className="flex items-center gap-2">
                       <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                       <span>Activating...</span>
                   </div>
               ) : (
                   'I have made this transfer'
               )}
           </button>
           <p className="text-center text-[10px] text-text-secondary-light mt-3 font-medium uppercase tracking-tight">
               By confirming, you agree to the <Link to="/terms" className="font-medium text-primary underline">Escrow Terms</Link>.
           </p>
       </div>
    </Layout>
  );
};

export default ConfirmPlanScreen;
