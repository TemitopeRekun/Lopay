
import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';

const PrivacyPolicy: React.FC = () => {
  return (
    <Layout>
      <Header title="Privacy Policy" />
      <div className="flex-1 p-6 overflow-y-auto pb-10">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-sm text-text-secondary-light mb-6">Last Updated: October 2023</p>
          
          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">1. Information We Collect</h2>
          <p className="text-sm text-text-secondary-light mb-4">
            We collect information you provide directly to us:
          </p>
          <ul className="list-disc pl-5 text-sm text-text-secondary-light mb-6 space-y-2">
            <li><strong>Account Information:</strong> Name, email, password, and phone number.</li>
            <li><strong>Student Information:</strong> Name of your child, grade, and school.</li>
            <li><strong>Financial Information:</strong> Transaction history, payment confirmations, and bank details (for school owners).</li>
          </ul>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">2. How We Use Your Information</h2>
          <p className="text-sm text-text-secondary-light mb-4">
            We use the collected data for:
          </p>
          <ul className="list-disc pl-5 text-sm text-text-secondary-light mb-6 space-y-2">
            <li>Processing your school fee payments and tracking installments.</li>
            <li>Verifying activation deposits via our administration panel.</li>
            <li>Sending reminders about upcoming or overdue payments.</li>
            <li>Communicating system updates and administrative broadcasts.</li>
          </ul>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">3. Data Sharing</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            We share relevant student and payment data with the specific school your child is registered with. This allows school bursars to verify your payments and update their records. We do not sell your personal information to third parties.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">4. Data Security</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            We implement industry-standard security measures to protect your information. Your passwords are encrypted, and we use secure protocols for all data transmissions.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">5. Your Rights</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            You have the right to access, correct, or delete your personal information. You can manage most of your profile data directly through the "Settings" and "Profile" tabs in the app.
          </p>

          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">6. Changes to This Policy</h2>
          <p className="text-sm text-text-secondary-light mb-6">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;
