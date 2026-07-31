
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { PaymentPlan, PaymentPlanOption } from '../types';
import { usePaymentCalculation } from '../hooks/useQueries';

interface LocationState {
    childName: string;
    schoolName: string;
    schoolId?: string; // We need to pass schoolId from AddChildScreen
    grade: string;
    totalFee: number;
    feeType: 'Semester' | 'Session';
}

const CalculatorScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const { totalFee, feeType, grade, schoolId } = state ?? ({} as LocationState);

  // Shared with ConfirmPlanScreen, so both screens show the same server-computed
  // figures the charge is later validated against.
  const {
    data: calculation,
    isLoading,
    isError,
  } = usePaymentCalculation(
    { schoolId, totalAmount: totalFee, feeType, grade },
    !!state,
  );

  // Fallback if accessed directly
  if (!state) {
      return (
          <Layout>
              <div className="p-8 text-center">
                  <p>No data provided.</p>
                  <button onClick={() => navigate('/dashboard')} className="text-primary font-bold mt-4">Go Home</button>
              </div>
          </Layout>
      )
  }

  const error = !schoolId
      ? 'Missing School Information'
      : isError
        ? 'Failed to load payment plans. Please try again.'
        : '';
  const loading = isLoading && !!schoolId;

  if (loading) {
      return (
          <Layout>
              <Header title="Payment Calculator" />
              <div className="flex flex-col items-center justify-center flex-1 p-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="mt-4 text-text-secondary-light">Calculating best plans for you...</p>
              </div>
          </Layout>
      );
  }

  if (error || !calculation) {
       return (
          <Layout>
              <Header title="Payment Calculator" />
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-danger mb-2">error</span>
                  <p className="text-text-secondary-light mb-4">{error || "Could not calculate plans"}</p>
                  <button onClick={() => navigate(-1)} className="text-primary font-bold">Go Back</button>
              </div>
          </Layout>
      );
  }

  const { 
    depositAmount = 0, 
    platformFeePercentage = 0, 
    plans = [], 
    totalPayable = 0, 
    totalInitialPayment = 0, 
    platformFeeAmount = 0 
  } = calculation;

  const handleSelectPlan = (planOption: PaymentPlanOption) => {
      const plan: PaymentPlan = {
          type: planOption.type,
          amount: planOption.totalAmount, // Use the total amount (base + fee)
          frequencyLabel: planOption.frequencyLabel,
          numberOfPayments: planOption.numberOfPayments
      };
      
      navigate('/confirm-plan', {
          state: {
              ...state,
              plan,
              depositAmount,
              // Pass the calculated percentage to ConfirmPlan so it matches
              serviceFeePercentage: platformFeePercentage,
              totalPayable,
              totalInitialPayment,
              platformFeeAmount,
              breakdown: {
                  baseAmount: planOption.baseAmount,
                  serviceFee: planOption.serviceFee,
                  totalAmount: planOption.totalAmount
              }
          }
      });
  };

  return (
    <Layout>
      <Header title="Payment Calculator" />
      <div className="flex flex-col flex-1 p-6 overflow-y-auto">
         <h1 className="text-3xl font-bold leading-tight mb-4 text-text-primary-light dark:text-text-primary-dark">
            How much is this {feeType === 'Session' ? "session's" : "term's"} fee?
         </h1>
         
         <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex flex-col gap-2">
            <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary">info</span>
                <p className="text-xs text-primary-dark dark:text-primary-light font-medium leading-relaxed">
                    <strong>Initial Payment Breakdown:</strong>
                </p>
            </div>
            <div className="pl-9 text-xs text-primary-dark dark:text-primary-light space-y-1">
                <div className="flex justify-between">
                    <span>Deposit ({(calculation.depositPercentage || 0) * 100}%):</span>
                    <span className="font-bold">₦{depositAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>Platform Fee ({(platformFeePercentage * 100)}%):</span>
                    <span className="font-bold">₦{platformFeeAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-primary/20 pt-1 mt-1">
                    <span className="font-bold">Total Initial Payment:</span>
                    <span className="font-bold">₦{totalInitialPayment.toLocaleString()}</span>
                </div>
            </div>
         </div>

         <div className="mb-8">
            <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">Fee Breakdown</p>
            <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex justify-between items-center text-sm text-text-secondary-light">
                    <span>School {feeType} Fee</span>
                    <span>₦{totalFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-text-secondary-light">
                    <span>Platform Fee</span>
                    <span>₦{platformFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>
                <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total Payable</span>
                    <span className="text-2xl font-bold">₦{totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
         </div>

         <div className="mb-4">
             <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-3">Choose Installment Frequency</h3>
             <div className="space-y-4">
                {plans.map((plan) => (
                    <div 
                        key={plan.type}
                        className={`group relative overflow-hidden rounded-2xl border-2 p-6 transition-all cursor-pointer ${
                            plan.type === 'Weekly' 
                                ? 'border-accent/30 bg-accent/5 hover:border-accent hover:bg-accent/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-card-dark hover:border-primary hover:bg-primary/5'
                        }`} 
                        onClick={() => handleSelectPlan(plan)}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className={`material-symbols-outlined ${plan.type === 'Weekly' ? 'text-accent' : 'text-primary'}`}>check_circle</span>
                        </div>
                        <p className={`text-xs font-bold mb-1 ${plan.type === 'Weekly' ? 'text-accent-dark' : 'text-text-secondary-light'}`}>
                            {plan.type} Plan ({plan.numberOfPayments} Payments)
                        </p>
                        <p className="text-3xl font-extrabold text-text-primary-light dark:text-text-primary-dark mb-2">
                            ₦{plan.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-lg text-text-secondary-light font-medium">{plan.frequencyLabel}</span>
                        </p>
                        <p className="text-sm text-text-secondary-light">{plan.numberOfPayments} {plan.type.toLowerCase()} payments for the remaining balance</p>
                    </div>
                ))}
             </div>
         </div>
         
         <div className="mt-4 mb-8 flex items-center justify-center gap-2 text-text-secondary-light">
             <span className="material-symbols-outlined text-sm">info</span>
             <span className="text-sm font-medium">Platform fee of {(platformFeePercentage * 100)}% applied to activation</span>
         </div>
      </div>
    </Layout>
  );
};

export default CalculatorScreen;
