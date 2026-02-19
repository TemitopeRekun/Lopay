
import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { useUI } from '../context/UIContext';

const SupportScreen: React.FC = () => {
  const { showToast } = useUI();

  return (
    <Layout>
      <Header title="Help & Support" />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-primary/5 p-6 rounded-2xl mb-8 text-center">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">support_agent</span>
            <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-1">How can we help?</h2>
            <p className="text-text-secondary-light text-sm">Our team is available 24/7 to assist you.</p>
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
        <div className="flex flex-col gap-3">
            <button 
                onClick={() => showToast("Connecting to an agent...", "info")}
                className="flex items-center gap-4 p-4 bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                <span className="material-symbols-outlined text-green-500">chat</span>
                <div className="text-left">
                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark">Live Chat</p>
                    <p className="text-xs text-text-secondary-light">Start a conversation now</p>
                </div>
            </button>
             <button 
                onClick={() => window.location.href = "mailto:support@lopay.app"}
                className="flex items-center gap-4 p-4 bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
             >
                <span className="material-symbols-outlined text-primary">mail</span>
                <div className="text-left">
                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark">Email Support</p>
                    <p className="text-xs text-text-secondary-light">support@lopay.app</p>
                </div>
            </button>
        </div>
      </div>
    </Layout>
  );
};

export default SupportScreen;
