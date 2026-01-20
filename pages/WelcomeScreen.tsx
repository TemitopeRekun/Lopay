
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="flex flex-col h-full min-h-screen justify-between bg-white dark:bg-background-dark">
        <div className="flex flex-col items-center pt-16 animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <span className="material-symbols-outlined text-4xl text-accent">account_balance</span>
            <span className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">LOPAY</span>
          </div>
          
          <div className="w-full px-6 py-8">
            <div className="w-full aspect-square bg-gradient-to-br from-accent/20 to-primary/20 rounded-3xl flex items-center justify-center overflow-hidden relative">
               {/* Abstract decorative shapes */}
               <div className="absolute top-10 left-10 w-32 h-32 bg-accent/30 rounded-full blur-2xl"></div>
               <div className="absolute bottom-10 right-10 w-40 h-40 bg-primary/30 rounded-full blur-3xl"></div>
               <span className="material-symbols-outlined text-[120px] text-accent z-10 relative">potted_plant</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col pb-12 px-6">
          <h1 className="text-text-primary-light dark:text-text-primary-dark tracking-tight text-4xl font-extrabold leading-tight text-center pb-4">
            Pay School Fees,<br/>Your Way.
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-lg font-medium leading-relaxed text-center pb-8">
            Break down tuition into simple weekly or monthly installments.
          </p>
          
          <button 
            onClick={() => navigate('/auth')}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-white text-lg font-bold shadow-xl shadow-accent/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default WelcomeScreen;
