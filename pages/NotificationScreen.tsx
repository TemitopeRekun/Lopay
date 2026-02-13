
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { useData } from '../context/DataContext';

const NotificationScreen: React.FC = () => {
  const { notifications } = useData();
  const [filter, setFilter] = useState<'All' | 'Payments' | 'Announcements'>('All');

  const getIcon = (type: string, status: string) => {
     if (status === 'success') return 'check_circle';
     if (status === 'warning') return 'notifications';
     if (status === 'error') return 'error';
     return 'campaign'; // default announcement
  };

  const getIconColor = (status: string) => {
      if (status === 'success') return 'text-success bg-success/10';
      if (status === 'warning') return 'text-warning bg-warning/10';
      if (status === 'error') return 'text-danger bg-danger/10';
      return 'text-primary bg-primary/10';
  };

  const filteredNotifications = notifications.filter(n => {
      if (filter === 'All') return true;
      if (filter === 'Payments') return n.type === 'payment' || n.type === 'alert';
      if (filter === 'Announcements') return n.type === 'announcement';
      return true;
  });

  return (
    <Layout showBottomNav>
      <Header title="Notifications" />
      <div className="p-4 flex flex-col gap-4 flex-1">
          <div className="flex gap-2 mb-2">
              <button 
                onClick={() => setFilter('All')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'All' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-text-secondary-light'}`}
              >
                  All
              </button>
              <button 
                onClick={() => setFilter('Payments')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'Payments' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-text-secondary-light'}`}
              >
                  Payments
              </button>
              <button 
                onClick={() => setFilter('Announcements')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'Announcements' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-text-secondary-light'}`}
              >
                  Announcements
              </button>
          </div>

          <h3 className="text-xs font-bold text-text-secondary-light uppercase tracking-wider mt-2">Recent</h3>
          
          <div className="flex flex-col gap-3 pb-4">
              {filteredNotifications.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                      No notifications found.
                  </div>
              ) : (
                  filteredNotifications.map((n) => (
                      <div key={n.id} className="flex gap-4 p-4 bg-white dark:bg-card-dark rounded-xl border-l-4 border-l-primary shadow-sm relative overflow-hidden transition-all hover:bg-gray-50 dark:hover:bg-white/5">
                          <div className={`size-10 shrink-0 rounded-full flex items-center justify-center ${getIconColor(n.status || 'info')}`}>
                              <span className="material-symbols-outlined text-xl">{getIcon(n.type, n.status || 'info')}</span>
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-text-primary-light dark:text-text-primary-dark">{n.title}</h4>
                              <p className="text-sm text-text-secondary-light mt-1">{n.message}</p>
                          </div>
                          <span className="text-[10px] text-text-secondary-light font-bold shrink-0">{n.timestamp}</span>
                      </div>
                  ))
              )}
          </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default NotificationScreen;
