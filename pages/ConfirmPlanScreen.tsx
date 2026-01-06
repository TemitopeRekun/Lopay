
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
       <Header title="Tuition Handoff Roadmap" />
       
       <div className="flex-1 p-6 overflow-y-auto pb-32">
          {/* Header Summary */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
              <div className="h-14 w-14 rounded-full overflow-hidden shadow-inner shrink-0">
                  <img src={`https://ui-avatars.com/api/?name=${childName.replace(' ','+')}&background=random`} alt="user" className="w-full h-full object-cover" />
              </div>
              <div>
                  <h3 className="text-lg font-bold leading-tight">{childName}</h3>
                  <p className="text-[10px] font-bold uppercase text-text-secondary-light">{grade} • {schoolName}</p>
              </div>
          </div>

          {/* Payment Phase Roadmap */}
          <div className="mb-8 relative">
              <div className="absolute left-[20px] top-[40px] bottom-[40px] w-0.5 bg-gray-200 dark:bg-gray-800 border-l border-dashed border-gray-400"></div>
              
              <div className="flex gap-4 mb-8 relative z-10">
                  <div className="size-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-white dark:ring-background-dark">1</div>
                  <div className="flex-1 bg-white dark:bg-card-dark p-4 rounded-2xl border border-primary/20 shadow-sm">
                      <p className="text-[10px] font-bold text-primary uppercase mb-1">Step 1: Activate with Lopay</p>
                      <h4 className="font-bold text-base mb-1">₦{initialActivationPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
                      <p className="text-xs text-text-secondary-light">Activation deposit + platform fee. Sent to Lopay Escrow.</p>
                  </div>
              </div>

              <div className="flex gap-4 relative z-10">
                  <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-800 text-text-secondary-light flex items-center justify-center font-bold ring-4 ring-white dark:ring-background-dark">2</div>
                  <div className="flex-1 bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm opacity-80">
                      <p className="text-[10px] font-bold text-text-secondary-light uppercase mb-1">Step 2: Direct to {entityType}</p>
                      <h4 className="font-bold text-base mb-1">₦{futureInstallmentAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} / installment</h4>
                      <p className="text-xs text-text-secondary-light">Paid directly to the {entityType.toLowerCase()}'s verified bank account.</p>
                  </div>
              </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden mb-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Activation Fee (to Lopay)</p>
              <h2 className="text-4xl font-extrabold tracking-tight mb-2">₦{initialActivationPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              <div className="flex items-center gap-2 mt-4 text-xs font-bold text-primary-light bg-primary/10 w-fit px-3 py-1.5 rounded-lg border border-primary/20">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Activation Only
              </div>
          </div>

          <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm mb-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                  {entityType} Installment Details
              </h3>
              <p className="text-[10px] text-text-secondary-light font-bold uppercase mb-3">Payable directly to institution after activation</p>
              <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-sm text-text-secondary-light">Installment Amount</span>
                      <span className="font-bold">₦{futureInstallmentAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {plan.frequencyLabel}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-sm text-text-secondary-light">Plan Duration</span>
                      <span className="font-bold">{monthsDuration} Months</span>
                  </div>
              </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-sm mb-3 uppercase tracking-wider text-text-secondary-light">Cost Transparency</h3>
              <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                      <span className="text-text-secondary-light">Initial Tuition Deposit (25%)</span>
                      <span className="font-medium">₦{depositAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-text-secondary-light">Platform Fee (2.5%)</span>
                      <span className="font-medium text-primary">₦{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-text-secondary-light">Direct Balance (75%)</span>
                      <span className="font-medium">₦{(totalFee * 0.75).toLocaleString()}</span>
                  </div>
              </div>
          </div>
       </div>

       <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800 z-20">
           <button 
             onClick={handleConfirm}
             disabled={isProcessing}
             className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
           >
               {isProcessing ? (
                   <div className="flex items-center gap-2">
                       <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                       <span>Processing...</span>
                   </div>
               ) : (
                   'Activate & Pay Deposit'
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
