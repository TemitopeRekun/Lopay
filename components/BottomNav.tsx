
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: userRole } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const baseClasses = "fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-md border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-card-dark/95 backdrop-blur-md pb-safe";

  if (userRole === 'owner') {
    return (
        <div className={baseClasses}>
        <div className="flex h-20 items-center justify-around px-2">
            <button
            onClick={() => navigate('/owner-dashboard')}
            className={`flex flex-col items-center gap-1 ${isActive('/owner-dashboard') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
            >
            <span className={`material-symbols-outlined ${isActive('/owner-dashboard') ? 'filled' : ''}`}>dashboard</span>
            <span className="text-[10px] font-bold">Overview</span>
            </button>
            
            <button
            onClick={() => navigate('/history')}
            className={`flex flex-col items-center gap-1 ${isActive('/history') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
            >
            <span className={`material-symbols-outlined ${isActive('/history') ? 'filled' : ''}`}>receipt_long</span>
            <span className="text-[10px] font-bold">History</span>
            </button>

            <button
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
            >
            <span className={`material-symbols-outlined ${isActive('/profile') ? 'filled' : ''}`}>manage_accounts</span>
            <span className="text-[10px] font-bold">Admin</span>
            </button>
        </div>
        </div>
    );
  }

  return (
    <div className={baseClasses}>
      <div className="flex h-20 items-center justify-around px-2">
        <button
          onClick={() => navigate('/dashboard')}
          className={`flex flex-col items-center gap-1 ${isActive('/dashboard') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
        >
          <span className={`material-symbols-outlined ${isActive('/dashboard') ? 'filled' : ''}`}>grid_view</span>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        
        <button
          onClick={() => navigate('/history')}
          className={`flex flex-col items-center gap-1 ${isActive('/history') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
        >
          <span className={`material-symbols-outlined ${isActive('/history') ? 'filled' : ''}`}>history</span>
          <span className="text-[10px] font-bold">History</span>
        </button>

        <button
           onClick={() => navigate('/notifications')}
           className={`flex flex-col items-center gap-1 ${isActive('/notifications') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
        >
          <span className={`material-symbols-outlined ${isActive('/notifications') ? 'filled' : ''}`}>notifications</span>
          <span className="text-[10px] font-bold">Alerts</span>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
        >
          <span className={`material-symbols-outlined ${isActive('/profile') ? 'filled' : ''}`}>person</span>
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
};
