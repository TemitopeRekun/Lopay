
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useTransactions, useChildren } from '../hooks/useQueries';

export const CalendarScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions(user?.id);
  const { data: childrenData = [] } = useChildren();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const daysInWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to normalize date to YYYY-MM-DD for comparison
  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const parseAppDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr === '-') return null;
      const now = new Date();
      
      if (dateStr.toLowerCase().includes('today')) {
          return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      if (dateStr.toLowerCase().includes('yesterday')) {
          const d = new Date(now);
          d.setDate(d.getDate() - 1);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      
      // Handle "Oct 15" or "Oct 26, 2023"
      let d = new Date(dateStr);
      if (isNaN(d.getTime())) {
          // Try adding current year if it's just "Month Day"
          d = new Date(`${dateStr}, ${now.getFullYear()}`);
      }
      
      if (!isNaN(d.getTime())) {
           return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      return null;
  };

  // Memoize events mapped by date key
  const eventsByDate = useMemo(() => {
      const map: Record<string, any[]> = {};

      // 1. Map Transactions
      transactions.forEach(t => {
          const date = parseAppDate(t.date);
          if (date) {
              const key = formatDateKey(date);
              if (!map[key]) map[key] = [];
              map[key].push({ type: 'transaction', data: t });
          }
      });

      // 2. Map Due Dates (Only for parents usually, but good for admin to see potential too)
      childrenData.forEach(c => {
          if (c.nextDueDate && c.status !== 'Completed') {
              const date = parseAppDate(c.nextDueDate);
              if (date) {
                  const key = formatDateKey(date);
                  if (!map[key]) map[key] = [];
                  map[key].push({ type: 'due_date', data: c });
              }
          }
      });

      return map;
  }, [transactions, childrenData]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(currentDate);
    const startDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before start of month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    // Days
    for (let i = 1; i <= totalDays; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const dateKey = formatDateKey(date);
        const isSelected = formatDateKey(selectedDate) === dateKey;
        const isToday = formatDateKey(new Date()) === dateKey;
        const hasEvents = !!eventsByDate[dateKey];
        const events = eventsByDate[dateKey] || [];
        
        // Determine dot color
        let dotClass = '';
        if (hasEvents) {
            const hasDue = events.some((e: any) => e.type === 'due_date');
            const hasTrans = events.some((e: any) => e.type === 'transaction');
            
            if (hasDue && hasTrans) dotClass = 'bg-purple-500';
            else if (hasDue) dotClass = 'bg-warning'; // Due date warning
            else dotClass = 'bg-success'; // Transaction success
        }

        days.push(
            <div 
                key={i} 
                onClick={() => setSelectedDate(date)}
                className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-all
                    ${isSelected ? 'bg-primary text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-text-primary-light dark:text-text-primary-dark'}
                    ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                `}
            >
                {i}
                {hasEvents && !isSelected && (
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${dotClass}`}></span>
                )}
            </div>
        );
    }
    return days;
  };

  const selectedEvents = eventsByDate[formatDateKey(selectedDate)] || [];

  return (
    <Layout>
      <Header title="Calendar" />
      <div className="flex-1 overflow-y-auto">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-6">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <span className="material-symbols-outlined text-text-secondary-light">chevron_left</span>
            </button>
            <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <span className="material-symbols-outlined text-text-secondary-light">chevron_right</span>
            </button>
        </div>

        {/* Calendar Grid */}
        <div className="px-4">
            <div className="grid grid-cols-7 mb-2">
                {daysInWeek.map(day => (
                    <div key={day} className="text-center text-xs font-bold text-text-secondary-light uppercase tracking-wider h-8 flex items-center justify-center">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 place-items-center gap-y-2">
                {renderCalendarDays()}
            </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 my-6 mx-4"></div>

        {/* Selected Date Details */}
        <div className="px-6 pb-6">
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>

            {selectedEvents.length === 0 ? (
                <div className="text-center py-8 text-text-secondary-light bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                    <p>No events for this day</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {selectedEvents.map((event: any, index: number) => {
                        if (event.type === 'transaction') {
                            const t = event.data;
                            return (
                                <div key={`t-${index}`} className="flex items-center justify-between p-4 bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                                            <span className="material-symbols-outlined text-xl">payments</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-primary-light dark:text-text-primary-dark">Payment Received</p>
                                            <p className="text-xs text-text-secondary-light">{t.childName} • {t.schoolName}</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-success">+₦{t.amount.toLocaleString()}</p>
                                </div>
                            );
                        } else {
                            const c = event.data;
                            return (
                                <div key={`d-${index}`} className="flex items-center justify-between p-4 bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                            <span className="material-symbols-outlined text-xl">event_upcoming</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-primary-light dark:text-text-primary-dark">Payment Due</p>
                                            <p className="text-xs text-text-secondary-light">{c.name} • {c.school}</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark">₦{c.nextInstallmentAmount.toLocaleString()}</p>
                                </div>
                            );
                        }
                    })}
                </div>
            )}
        </div>
      </div>
    </Layout>
  );
};

export default CalendarScreen;
