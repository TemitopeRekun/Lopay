
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

  const state = location.state as { paymentType?: string, amount?: number, childId?: string } | null;
  const isPaymentFlow = state?.paymentType === 'installment';
  const isStudent = userRole === 'university_student';

  const child = useMemo(() => {
    return childrenData.find(c => c.id === state?.childId);
  }, [childrenData, state?.childId]);

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
        institutionName: isStudent ? "Tuition Activation" : "Platform Activation"
    };
  }, [child, institutionBank, isStudent]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Account number copied!");
  };

  const handlePaymentSent = () => {
      if (state?.childId && state?.amount) {
          setIsProcessing(true);
          setTimeout(() => {
              submitPayment(state.childId!, state.amount!);
              navigate('/dashboard');
          }, 1500);
      }
  };

  const entityType = isStudent ? "Institution" : "School";

  return (
    <Layout>
      <Header title={activeBankDetails.isLopayEscrow ? "Activation Deposit" : `${entityType} Payment`} />
      <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
          {isPaymentFlow && (
              <div className={`mb-8 text-center rounded-2xl p-6 border transition-all ${activeBankDetails.isLopayEscrow ? 'bg-primary/10 border-primary/20' : 'bg-success/10 border-success/20'}`}>
                  <p className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-bold uppercase tracking-widest mb-1">
                      {activeBankDetails.isLopayEscrow ? "Phase 1: Activation" : `Phase 2: Direct to ${entityType}`}
                  </p>
                  <p className={`text-4xl font-extrabold ${activeBankDetails.isLopayEscrow ? 'text-primary' : 'text-success'}`}>
                      ₦{state.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
              </div>
          )}

          <div className={`bg-white dark:bg-card-dark border-2 rounded-2xl p-6 shadow-sm mb-6 ${activeBankDetails.isLopayEscrow ? 'border-primary/30' : 'border-success/30'}`}>
              <div className="space-y-5">
                  <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">Account Name</span>
                      <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-base">{activeBankDetails.accountName}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">Bank Name</span>
                      <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-base">{activeBankDetails.bankName}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">Account Number</span>
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          <span className="font-mono text-2xl font-bold tracking-widest text-text-primary-light dark:text-text-primary-dark">{activeBankDetails.accountNumber}</span>
                          <button 
                            className={`${activeBankDetails.isLopayEscrow ? 'bg-primary' : 'bg-success'} text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center gap-1`}
                            onClick={() => copyToClipboard(activeBankDetails.accountNumber)}
                          >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                              Copy
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl text-center">
              <p className="text-xs text-text-secondary-light">Please complete the transfer through your bank app. Once sent, tap the button below to update your balance.</p>
          </div>

          <div className="mt-auto pt-4">
              <button 
                onClick={handlePaymentSent}
                disabled={isProcessing}
                className={`w-full h-14 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all ${activeBankDetails.isLopayEscrow ? 'bg-primary shadow-primary/25 hover:bg-primary-dark' : 'bg-success shadow-success/25 hover:bg-success-dark'}`}
              >
                  {isProcessing ? (
                      <div className="flex items-center gap-2">
                          <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Updating...</span>
                      </div>
                  ) : (
                      'I have made this transfer'
                  )}
              </button>
          </div>
      </div>
    </Layout>
  );
};

export default PaymentMethodsScreen;
