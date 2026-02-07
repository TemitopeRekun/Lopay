
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

const PaymentMethodsScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { submitPayment, childrenData, schools, allUsers, userRole } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const state = location.state as { paymentType?: string, amount?: number, childId?: string, allowCustom?: boolean, isCustomOnly?: boolean } | null;
  const isPaymentFlow = state?.paymentType === 'installment';
  const isStudent = userRole === 'university_student';

  const child = useMemo(() => {
    return childrenData.find(c => c.id === state?.childId);
  }, [childrenData, state?.childId]);

  const [paymentAmount, setPaymentAmount] = useState(state?.amount || 0);
  const [isEditingAmount, setIsEditingAmount] = useState(!!state?.isCustomOnly);

  const school = useMemo(() => {
    return schools.find(s => s.name === child?.school);
  }, [schools, child?.school]);

  const institutionBank = useMemo(() => {
    if (!school) return null;
    const owner = allUsers.find(u => u.role === 'school_owner' && u.schoolId === school.id);
    if (owner && owner.accountNumber) {
        return {
            accountName: owner.accountName,
            bankName: owner.bankName,
            accountNumber: owner.accountNumber,
            isLopayEscrow: false,
            institutionName: school.name
        };
    }
    return null;
  }, [allUsers, school]);

  const activeBankDetails = useMemo(() => {
    if (child && child.paidAmount > 0 && institutionBank) {
        return institutionBank;
    }
    
    return {
        accountName: "Lopay Technologies",
        bankName: "Moniepoint",
        accountNumber: "9090390581",
        isLopayEscrow: true,
        institutionName: isStudent ? "Lopay Tuition Hub" : "Lopay Activation Hub"
    };
  }, [child, institutionBank, isStudent]);

  const canEditAmount = !activeBankDetails.isLopayEscrow && state?.allowCustom;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Account number copied!");
  };

  const handleSnapReceipt = () => {
      setReceiptImage('https://images.unsplash.com/photo-1554224155-169641357599?auto=format&fit=crop&q=80&w=400');
  };

  const handlePaymentSent = async () => {
      if (state?.childId && paymentAmount > 0) {
          setIsProcessing(true);
          try {
              await submitPayment(state.childId!, paymentAmount, receiptImage || undefined);
              alert("Payment submitted successfully! Waiting for school confirmation.");
              navigate('/dashboard');
          } catch (error) {
              console.error(error);
              alert("Failed to submit payment. Please try again.");
          } finally {
              setIsProcessing(false);
          }
      } else {
          alert("Please enter a valid amount.");
      }
  };

  const entityType = isStudent ? "Institution" : "School";

  return (
    <Layout>
      <Header title={activeBankDetails.isLopayEscrow ? "Activation Deposit" : `${entityType} Payment`} />
      <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
          
          <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 flex items-center gap-4 animate-fade-in">
              <div className={`size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg ${activeBankDetails.isLopayEscrow ? 'bg-primary' : 'bg-success'}`}>
                  <span className="material-symbols-outlined text-2xl">
                    {activeBankDetails.isLopayEscrow ? 'verified_user' : 'account_balance'}
                  </span>
              </div>
              <div className="overflow-hidden">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-secondary-light">Receiving Entity</p>
                  <h3 className="text-sm font-bold truncate text-text-primary-light dark:text-text-primary-dark">
                    {activeBankDetails.institutionName}
                  </h3>
              </div>
          </div>

          {isPaymentFlow && (
              <div className={`mb-6 text-center rounded-[32px] p-6 border-2 transition-all shadow-xl shadow-gray-100 dark:shadow-none animate-fade-in-up ${activeBankDetails.isLopayEscrow ? 'bg-primary/5 border-primary/20' : 'bg-success/5 border-success/20'}`}>
                  <div className="flex justify-center mb-2">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${activeBankDetails.isLopayEscrow ? 'bg-primary text-white' : 'bg-success text-white'}`}>
                          {activeBankDetails.isLopayEscrow ? "Phase 1: Activation" : `Phase 2: Direct Payment`}
                      </span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-bold uppercase tracking-widest mb-1">Transfer Amount</p>
                    
                    {isEditingAmount && canEditAmount ? (
                        <div className="relative w-full max-w-[200px] flex items-center justify-center">
                            <span className="text-2xl font-black text-success mr-1">₦</span>
                            <input 
                                type="number"
                                autoFocus
                                value={paymentAmount || ''}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const remaining = (child?.totalFee || 0) - (child?.paidAmount || 0);
                                    setPaymentAmount(Math.min(val, remaining));
                                }}
                                className="w-full bg-transparent border-none text-center text-4xl font-black text-success p-0 outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className={`text-4xl font-black tracking-tight ${activeBankDetails.isLopayEscrow ? 'text-primary' : 'text-success'}`}>
                                ₦{paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            {canEditAmount && (
                                <button 
                                    onClick={() => setIsEditingAmount(true)}
                                    className="size-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-text-secondary-light hover:text-success transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                            )}
                        </div>
                    )}
                    
                    {!activeBankDetails.isLopayEscrow && child && (
                        <p className="text-[9px] font-bold text-text-secondary-light mt-1 uppercase">
                            Outstanding Balance: ₦{(child.totalFee - child.paidAmount).toLocaleString()}
                        </p>
                    )}
                  </div>
              </div>
          )}

          <div className={`bg-white dark:bg-card-dark border-2 rounded-[32px] p-6 shadow-sm mb-6 relative overflow-hidden transition-all animate-fade-in-up delay-75 ${activeBankDetails.isLopayEscrow ? 'border-primary/20' : 'border-success/20'}`}>
              <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">Bank Provider</span>
                      <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">{activeBankDetails.bankName}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">Account Holder</span>
                      <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">{activeBankDetails.accountName}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">Account Identifier</span>
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-1">
                          <span className="font-mono text-2xl font-black tracking-[0.2em] text-text-primary-light dark:text-text-primary-dark">
                            {activeBankDetails.accountNumber}
                          </span>
                          <button 
                            className={`size-11 flex items-center justify-center rounded-xl text-white shadow-lg active:scale-90 transition-all ${activeBankDetails.isLopayEscrow ? 'bg-primary shadow-primary/20' : 'bg-success shadow-success/20'}`}
                            onClick={() => copyToClipboard(activeBankDetails.accountNumber)}
                          >
                              <span className="material-symbols-outlined text-xl">content_copy</span>
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="mb-6">
              <p className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest mb-2 px-1">Proof of Transfer</p>
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
          </div>

          <div className="mt-auto pt-4">
              <button 
                onClick={handlePaymentSent}
                disabled={isProcessing || paymentAmount <= 0}
                className={`w-full h-16 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 ${activeBankDetails.isLopayEscrow ? 'bg-primary shadow-primary/20' : 'bg-success shadow-success/20'}`}
              >
                  {isProcessing ? (
                      <div className="flex items-center gap-3">
                          <span className="size-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Processing...</span>
                      </div>
                  ) : (
                      'I have made this transfer'
                  )}
              </button>
              <p className="text-center text-[10px] text-text-secondary-light mt-4 font-bold uppercase tracking-tight">
                256-bit Secure Transaction
              </p>
          </div>
      </div>
    </Layout>
  );
};

export default PaymentMethodsScreen;
