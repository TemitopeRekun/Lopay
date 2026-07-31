
import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';

const SUPPORT_EMAIL = 'support@lopay.app';

const SupportScreen: React.FC = () => {
  return (
    <Layout>
      <Header title="Help & Support" />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-primary/5 p-6 rounded-2xl mb-8 text-center">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">support_agent</span>
            <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-1">How can we help?</h2>
            <p className="text-text-secondary-light text-sm">Email us and we&apos;ll get back to you.</p>
        </div>

        <h3 className="font-bold text-lg mb-4 text-text-primary-light dark:text-text-primary-dark">Frequently Asked Questions</h3>
        <div className="space-y-4">
            {[
                { q: "How do I change my payment plan?", a: "You can create a new plan for the next term. Current plans are fixed until completion." },
                { q: "Is my card information safe?", a: "Yes, we use bank-grade encryption and do not store your full card details." },
                { q: "How do I add another child?", a: "Go to the Dashboard and tap the + button in the bottom right corner." }
            ].map((item, i) => (
                <div key={i} className="bg-white dark:bg-card-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark mb-2">{item.q}</p>
                    <p className="text-sm text-text-secondary-light">{item.a}</p>
                </div>
            ))}
        </div>

        <h3 className="font-bold text-lg mb-4 mt-8 text-text-primary-light dark:text-text-primary-dark">Contact Us</h3>
        {/*
          A "Live Chat" button used to sit above this one. It showed a
          "Connecting to an agent..." toast and did nothing else — there is no chat
          backend, so it read as a support channel that silently swallowed the
          request. Email is the channel that actually reaches someone.
        */}
        <div className="flex flex-col gap-3">
             <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
             >
                <span className="material-symbols-outlined text-primary">mail</span>
                <div className="text-left">
                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark">Email Support</p>
                    <p className="text-xs text-text-secondary-light">{SUPPORT_EMAIL}</p>
                </div>
            </a>
        </div>
      </div>
    </Layout>
  );
};

export default SupportScreen;
