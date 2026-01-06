
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        setDarkMode(false);
    } else {
        html.classList.add('dark');
        setDarkMode(true);
    }
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

          <section>
              <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4">Preferences</h3>
              <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-primary">notifications</span>
                          </div>
                          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">Push Notifications</span>
                      </div>
                      <button 
                        onClick={() => setNotifications(!notifications)}
                        className={`w-12 h-7 rounded-full transition-colors relative ${notifications ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'}`}
                      >
                          <div className={`size-5 bg-white rounded-full absolute top-1 transition-transform ${notifications ? 'left-6' : 'left-1'}`}></div>
                      </button>
                  </div>
                  <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-purple-500">fingerprint</span>
                          </div>
                          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">Biometric Login</span>
                      </div>
                      <button 
                        onClick={() => setBiometrics(!biometrics)}
                        className={`w-12 h-7 rounded-full transition-colors relative ${biometrics ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'}`}
                      >
                          <div className={`size-5 bg-white rounded-full absolute top-1 transition-transform ${biometrics ? 'left-6' : 'left-1'}`}></div>
                      </button>
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
