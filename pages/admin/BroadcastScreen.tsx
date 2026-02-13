
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useBroadcast } from '../../hooks/useQueries';

const BroadcastScreen: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: sendBroadcast } = useBroadcast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    sendBroadcast({ title, message });
    navigate('/owner-dashboard');
    // In a real app, this would show a toast success message
  };

  return (
    <Layout>
      <Header title="Send Broadcast" />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 gap-6">
        <div className="bg-primary/5 p-4 rounded-xl text-sm text-primary border border-primary/20 mb-2">
            This message will be sent to all parents registered on the platform as a notification.
        </div>

        <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Subject / Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. System Maintenance Update"
                required
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Message Body</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-field w-full h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Type your announcement here..."
                required
              />
            </div>
        </div>

        <button 
            type="submit"
            className="mt-auto w-full h-14 bg-accent text-white rounded-xl font-bold text-lg shadow-lg shadow-accent/25 hover:opacity-90 transition-opacity"
        >
            Send Announcement
        </button>
      </form>
    </Layout>
  );
};

export default BroadcastScreen;
