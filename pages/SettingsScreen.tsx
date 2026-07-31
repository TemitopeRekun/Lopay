
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { applyTheme, storeTheme, type Theme } from '../utils/theme';

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Persist the choice. It used to live only on the <html> element, so it reset on
  // every reload and the toggle appeared to forget what you told it.
  const toggleDarkMode = () => {
    const next: Theme = darkMode ? 'light' : 'dark';
    applyTheme(next);
    storeTheme(next);
    setDarkMode(next === 'dark');
  };

  const handleTerms = () => {
      navigate('/terms');
  };

  const handlePrivacy = () => {
      navigate('/privacy');
  };

  return (
    <Layout>
      <Header title="Settings" />
      <div className="flex-1 p-6 flex flex-col gap-6">
          <section>
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4">Appearance</h3>
              <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-text-secondary-light">dark_mode</span>
                          </div>
                          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">Dark Mode</span>
                      </div>
                      <button 
                        onClick={toggleDarkMode}
                        className={`w-12 h-7 rounded-full transition-colors relative ${darkMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                      >
                          <div className={`size-5 bg-white rounded-full absolute top-1 transition-transform ${darkMode ? 'left-6' : 'left-1'}`}></div>
                      </button>
                  </div>
              </div>
          </section>

          {/*
            "Push Notifications" and "Biometric Login" toggles used to live here.
            Both were local useState only: flipping them changed a switch colour and
            nothing else — no preference was stored and no capability was enabled or
            disabled. Push in particular reads as a working opt-out when the app has
            never registered a device token with the backend, so no push could arrive
            in either position.

            They come back when there is something behind them to turn on.
          */}

          <section>
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4">Notifications</h3>
              <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                      <div className="size-8 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary">notifications</span>
                      </div>
                      <div>
                          <p className="font-medium text-text-primary-light dark:text-text-primary-dark">In-app alerts</p>
                          <p className="text-xs text-text-secondary-light mt-1 leading-relaxed">
                              Payment confirmations, rejections and reminders appear under
                              Alerts. Device push notifications aren&apos;t available yet.
                          </p>
                      </div>
                  </div>
              </div>
          </section>

          <section>
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4">About</h3>
              <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                   <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
                       <span className="text-text-primary-light dark:text-text-primary-dark">Version</span>
                       <span className="text-text-secondary-light">1.0.2 (Build 45)</span>
                   </div>
                   <div 
                    onClick={handleTerms}
                    className="p-4 flex justify-between items-center cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                   >
                       <span className="text-text-primary-light dark:text-text-primary-dark">Terms of Service</span>
                       <span className="material-symbols-outlined text-text-secondary-light">chevron_right</span>
                   </div>
                   <div 
                    onClick={handlePrivacy}
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                   >
                       <span className="text-text-primary-light dark:text-text-primary-dark">Privacy Policy</span>
                       <span className="material-symbols-outlined text-text-secondary-light">chevron_right</span>
                   </div>
              </div>
          </section>
      </div>
    </Layout>
  );
};

export default SettingsScreen;
