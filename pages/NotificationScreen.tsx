
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { useData } from '../context/DataContext';

const NotificationScreen: React.FC = () => {
  const { notifications, markNotificationRead } = useData();
  const [filter, setFilter] =
    useState<"All" | "Payments" | "Announcements">("All");
  const [selectedNotification, setSelectedNotification] = useState<
    (typeof notifications)[number] | null
  >(null);
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [recentlyReadIds, setRecentlyReadIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  const filteredNotifications = notifications.filter((n) => {
      if (filter === 'All') return true;
      if (filter === 'Payments') return n.type === 'payment' || n.type === 'alert';
      if (filter === 'Announcements') return n.type === 'announcement';
      return true;
  });

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleOpenNotification = async (
    notification: (typeof notifications)[number],
  ) => {
    setSelectedNotification(notification);
    if (notification.read || pendingReadIds.has(notification.id)) return;

    setPendingReadIds((prev) => new Set([...prev, notification.id]));
    try {
      await markNotificationRead(notification.id);
      setRecentlyReadIds((prev) => new Set([...prev, notification.id]));
      window.setTimeout(() => {
        setRecentlyReadIds((prev) => {
          const next = new Set(prev);
          next.delete(notification.id);
          return next;
        });
      }, 600);
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const unreadIds = unread.map((n) => n.id);

    setPendingReadIds((prev) => new Set([...prev, ...unreadIds]));
    try {
      await Promise.all(unreadIds.map((id) => markNotificationRead(id)));
      setRecentlyReadIds((prev) => new Set([...prev, ...unreadIds]));
      window.setTimeout(() => {
        setRecentlyReadIds((prev) => {
          const next = new Set(prev);
          unreadIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 600);
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        unreadIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  return (
    <Layout showBottomNav>
      <Header title="Notifications" />
      <div className="p-4 flex flex-col gap-4 flex-1">
          <div className="flex gap-2 mb-2 items-center">
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
              <div className="ml-auto flex items-center gap-3">
                {unreadCount > 0 && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-text-secondary-light">
                    <span className="size-2 rounded-full bg-danger" />
                    {unreadCount} Unread
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-text-secondary-light disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  Mark all read
                </button>
              </div>
          </div>

          <h3 className="text-xs font-bold text-text-secondary-light uppercase tracking-wider mt-2">Recent</h3>
          
          <div className="flex flex-col gap-3 pb-4">
              {filteredNotifications.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                      No notifications found.
                  </div>
              ) : (
                  filteredNotifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleOpenNotification(n)}
                        className={`flex gap-4 p-4 bg-white dark:bg-card-dark rounded-xl border-l-4 shadow-sm relative overflow-hidden transition-all duration-300 hover:bg-gray-50 dark:hover:bg-white/5 text-left ${
                          n.read ? "border-l-transparent opacity-80" : "border-l-primary"
                        } ${
                          recentlyReadIds.has(n.id)
                            ? "ring-2 ring-primary/30 scale-[0.99]"
                            : ""
                        }`}
                      >
                          {!n.read && (
                            <span className="absolute top-3 right-3 size-2 rounded-full bg-danger" />
                          )}
                          <div className={`size-10 shrink-0 rounded-full flex items-center justify-center ${getIconColor(n.status || 'info')}`}>
                              <span className="material-symbols-outlined text-xl">{getIcon(n.type, n.status || 'info')}</span>
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-text-primary-light dark:text-text-primary-dark">{n.title}</h4>
                              <p className="text-sm text-text-secondary-light mt-1 line-clamp-2">{n.message}</p>
                          </div>
                          <span className="text-[10px] text-text-secondary-light font-bold shrink-0">{n.timestamp}</span>
                      </button>
                  ))
              )}
          </div>
      </div>
      <BottomNav />

      {selectedNotification &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setSelectedNotification(null)}
          >
            <div
              className="w-full max-w-md bg-white dark:bg-card-dark rounded-3xl p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-11 rounded-full flex items-center justify-center ${getIconColor(
                      selectedNotification.status || "info",
                    )}`}
                  >
                    <span className="material-symbols-outlined text-2xl">
                      {getIcon(
                        selectedNotification.type,
                        selectedNotification.status || "info",
                      )}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-text-secondary-light">
                      Notification
                    </p>
                    <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                      {selectedNotification.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="size-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-text-secondary-light"
                >
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                </button>
              </div>

              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary-light mb-2">
                  Details
                </p>
                <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                  {selectedNotification.message}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-text-secondary-light">
                <span>{selectedNotification.type}</span>
                <span>{selectedNotification.timestamp}</span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>,
          document.body,
        )}
    </Layout>
  );
};

export default NotificationScreen;
