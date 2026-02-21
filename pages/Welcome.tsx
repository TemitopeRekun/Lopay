import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');

  return (
    <Layout>
      <div
        className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="flex flex-col grow justify-between">
          <div className="flex flex-col items-center pt-16">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <span className="material-symbols-outlined text-4xl text-primary-green">account_balance</span>
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">LOPAY</span>
          </div>

          {/* Conditional Rendering: If pure landing page, show hero. If auth, show form. 
              The design shows a transition. I'll stick to the "Sign Up / Login" form design as default for 'Get Started' */}
          
          <div className="w-full grow px-4 py-8 sm:px-6 md:px-8">
            <div className="flex flex-col items-center justify-center pt-8">
               <h1 className="text-slate-900 dark:text-white tracking-light text-[32px] font-bold leading-tight px-4 text-center pb-3">Pay School Fees, Your Way.</h1>
               <p className="text-slate-600 dark:text-gray-300 text-base font-normal leading-normal pb-8 text-center max-w-xs">Break down tuition into simple weekly or monthly installments.</p>
            </div>

            {/* Segmented Buttons */}
            <div className="flex py-3">
              <div className="flex h-12 flex-1 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 p-1">
                <button
                  onClick={() => setMode('signup')}
                  className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-colors ${mode === 'signup' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-blue' : 'text-slate-500'}`}
                >
                  <span className="truncate text-sm font-medium">Sign Up</span>
                </button>
                <button
                  onClick={() => setMode('login')}
                   className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-colors ${mode === 'login' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-blue' : 'text-slate-500'}`}
                >
                  <span className="truncate text-sm font-medium">Login</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4 py-3">
              {mode === 'signup' && (
                <label className="flex flex-col w-full">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal pb-2">Full Name</p>
                  <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary-blue/50 border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 px-4 text-base" placeholder="Enter your full name" type="text" />
                </label>
              )}
              <label className="flex flex-col w-full">
                <p className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal pb-2">Email Address</p>
                <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary-blue/50 border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 px-4 text-base" placeholder="Enter your email" type="email" />
              </label>
              <label className="flex flex-col w-full">
                <p className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal pb-2">Password</p>
                <div className="relative flex items-center">
                  <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary-blue/50 border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 px-4 pr-12 text-base" placeholder="Enter your password" type="password" />
                  <button className="absolute right-0 flex h-full w-12 items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined">visibility_off</span>
                  </button>
                </div>
              </label>
            </div>

            {/* CTA Button */}
            <div className="py-3">
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex h-14 w-full items-center justify-center rounded-lg bg-primary-blue text-white text-base font-bold leading-normal shadow-sm transition-opacity hover:opacity-90"
              >
                {mode === 'signup' ? 'Create Account' : 'Login'}
              </button>
            </div>

            <p className="text-center text-xs text-slate-500">By creating an account, you agree to our <a className="font-medium text-primary-blue" href="#">Terms of Service</a> and <a className="font-medium text-primary-blue" href="#">Privacy Policy</a>.</p>

            {/* Social Logins */}
            <div className="flex items-center gap-4 py-6">
              <hr className="flex-1 border-t border-black/10 dark:border-white/10" />
              <p className="text-sm font-medium text-slate-500">OR</p>
              <hr className="flex-1 border-t border-black/10 dark:border-white/10" />
            </div>

            <div className="flex flex-col gap-4">
              <button className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-bold leading-normal shadow-sm transition-opacity hover:opacity-90">
                <img alt="Apple logo" className="h-6 w-6 dark:invert-0 invert" src="https://lh3.googleusercontent.com/aida-public/AB6AXuANNfwLLaqv5SmbPhiTaERQnKYVe0--KowHjmVp64An6q5pKAqMueFdByFL8p0WJ1PE9hQOYqYy-bnUJMpa0n9oWeDE6I9Bsg4uU0ZvfuSrhqp6onuRqws2aL-iLQHaZ9qZASxVHg1Gsc0R9-FRq9kjH9XZDvP6DfIkAo039IbCPk4zS0bOckVoF1wu_XtxP1i-StIjUbvIC_xgZph_3XfzPvMfLDZ_saJm164BzRA8J6qKq8hwVXiVzRCEvsfiTwZct1bdlU5vqdY" />
                <span>Continue with Apple</span>
              </button>
              <button className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-slate-900 dark:text-white text-base font-bold leading-normal shadow-sm hover:bg-black/5 dark:hover:bg-white/5">
                <img alt="Google logo" className="h-6 w-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxhYyxHkwE8AGXc48A8Qa_6ZQPcQEfAE9nVGUaBH37YfzaB1SVx6-Vx5wKcS3xUnHdw0Zg43wGhixlFJ8fXbzOXYAa0syM2oH912fG0gjsqMmhIXKtPzRzwFynsdaB5VQvxkn8WdQzeWp06LDVyeD_a2gsGAcgxI0GqBgc9ATOzwvWivxKDFmVaAZa9mDY6Zed-wh1Wcsd5e3QIaEAR-TW1QHy0pbgAsd-aQQO-vDDGVdI__ST_LzWCVYod_nydb8sE64wenHRiLU" />
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
