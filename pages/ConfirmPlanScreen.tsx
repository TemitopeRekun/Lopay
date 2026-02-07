
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
    schoolId?: string;
    totalInitialPayment?: number;
    platformFeeAmount?: number;
}

const ConfirmPlanScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addChild, userRole } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  
  const state = location.state as LocationState;

  if (!state) return null;

  const { childName, schoolName, grade, totalFee, plan, depositAmount, feeType, schoolId } = state;
  const isStudent = userRole === 'university_student';
  const entityType = isStudent ? "Institution" : "School";
  
  // Use backend values or fallback
  const platformFee = state.platformFeeAmount || (totalFee * 0.025);
  const initialActivationPayment = state.totalInitialPayment || (depositAmount + platformFee);
  
  // Standard installment amount for later (remaining 75% / plan length)
  const futureInstallmentAmount = (totalFee * 0.75) / plan.numberOfPayments;

  const monthsDuration = feeType === 'Session' ? 7 : 3;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Account number copied!");
  };

  const handleSnapReceipt = () => {
      // Using a reliable placeholder image service instead of a potentially broken Unsplash link
      setReceiptImage('https://dummyimage.com/600x800/e2e8f0/1e293b.png&text=Payment+Receipt');
  };

  const handleConfirm = () => {
      if (!receiptImage) {
          alert("Please upload a payment receipt to proceed.");
          return;
      }
      if (!schoolId) {
          alert("Missing school information. Please restart the process.");
          return;
      }

      setIsProcessing(true);
      
      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (plan.type === 'Weekly') {
        endDate.setDate(startDate.getDate() + (plan.numberOfPayments * 7));
      } else {
        endDate.setMonth(startDate.getMonth() + plan.numberOfPayments);
      }

      setTimeout(async () => {
          try {
            await addChild({
                childName,
                schoolId,
                grade,
                installmentFrequency: plan.type,
                firstPaymentPaid: initialActivationPayment,
                termStartDate: startDate.toISOString(),
                termEndDate: endDate.toISOString()
            }, receiptImage);

            navigate('/dashboard');
          } catch (err: any) {
            console.error("Confirmation failed detailed:", err.response?.data || err.message);
            const backendMessage = err.response?.data?.message;
            // Handle array of error messages (e.g. class-validator)
            const errorMessage = Array.isArray(backendMessage) 
                ? backendMessage.join(', ') 
                : (backendMessage || err.message || "Failed to confirm enrollment.");
            
            alert(`Enrollment Failed: ${errorMessage}`);
            setIsProcessing(false);
          }
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
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4 px-1">Proof of Transfer</h3>
              {receiptImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 h-32">
                      <img src={receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                      <button onClick={() => setReceiptImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                          <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                  </div>
              ) : (
                  <button 
                    onClick={handleSnapReceipt}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-text-secondary-light group"
                  >
                      <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
                          <span className="material-symbols-outlined">photo_camera</span>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-tight">Upload Payment Receipt</span>
                  </button>
              )}
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
