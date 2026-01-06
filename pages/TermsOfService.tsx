
import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';

const TermsOfService: React.FC = () => {
  return (
    <Layout>
      <Header title="Terms of Service" />
      <div className="flex-1 p-6 overflow-y-auto pb-10">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-sm text-text-secondary-light mb-6">Last Updated: October 2023</p>
          
          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">1. Acceptance of Terms</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            By accessing or using LOPAY, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">2. Description of Service</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            LOPAY is a financial technology platform that facilitates the payment of school fees through installment plans. We provide a bridge between parents and schools to manage educational expenses.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">3. User Obligations</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            Users must provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">4. Payment Terms</h2>
          <ul className="list-disc pl-5 text-sm text-text-secondary-light mb-6 space-y-2">
            <li><strong>Activation Deposit:</strong> A mandatory initial deposit (typically 25%) plus a platform fee is required to activate any installment plan.</li>
            <li><strong>Installments:</strong> Subsequent payments must be made according to the chosen schedule (weekly or monthly).</li>
            <li><strong>Direct Settlement:</strong> After activation, installments are paid directly to the school's designated bank account as shown in the app.</li>
          </ul>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">5. Fees and Charges</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            LOPAY charges a platform service fee (typically 2.5% to 5%) for providing the installment infrastructure. These fees are non-refundable.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">6. Default and Termination</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            Failure to meet installment deadlines may result in a "Defaulter" status. Schools reserve the right to restrict access to educational services if fees are not settled as agreed. LOPAY may suspend your account for persistent non-payment.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">7. Limitation of Liability</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            LOPAY is a payment facilitator and is not responsible for the quality of education provided by participating schools. We are not liable for any financial losses beyond the scope of our transaction services.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TermsOfService;
