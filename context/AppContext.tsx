
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Child, Notification, Transaction, School, User } from '../types';
import { API } from '../services/api';

interface AppContextType {
  childrenData: Child[];
  transactions: Transaction[];
  notifications: Notification[];
  schools: School[];
  allUsers: User[]; 
  
  addChild: (child: Omit<Child, 'parentId'>) => void;
  deleteChild: (childId: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'userId'>) => void;
  submitPayment: (childId: string, amount: number) => void;
  addSchool: (school: School) => void;
  updateSchool: (school: School) => void;
  deleteSchool: (schoolId: string) => void;
  deleteAllSchools: () => void;
  deleteUser: (userId: string) => void;
  sendBroadcast: (title: string, message: string) => void;
  // Added for manual payment verification flow
  approvePayment: (transactionId: string) => void;
  declinePayment: (transactionId: string) => void;
  
  isAuthenticated: boolean;
  currentUser: User | null;
  userRole: 'parent' | 'owner' | 'school_owner' | 'university_student';
  activeSchoolId: string | null; 
  isOwnerAccount: boolean;
  isSchoolOwner: boolean;
  isUniversityStudent: boolean;
  login: (email: string, password?: string) => User | false;
  signup: (name: string, email: string, phoneNumber: string, password?: string, role?: 'parent' | 'school_owner' | 'university_student', schoolId?: string, bankDetails?: { bankName: string, accountName: string, accountNumber: string }) => boolean;
  logout: () => void;
  switchRole: () => void;
  setActingRole: (role: 'parent' | 'owner' | 'school_owner' | 'university_student', schoolId?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_USER_ID = 'user-demo-1';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>(() => API.users.list());
  const [schools, setSchools] = useState<School[]>(() => API.schools.list());
  const [allChildren, setAllChildren] = useState<Child[]>(() => API.children.list());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => API.transactions.list());
  const [allNotifications, setAllNotifications] = useState<Notification[]>(() => API.notifications.list());

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedId = API.auth.getCurrentUserId();
    if (!savedId) return null;
    return API.auth.getUserById(savedId);
  });

  const isAuthenticated = !!currentUser;
  const [userRole, setUserRole] = useState<'parent' | 'owner' | 'school_owner' | 'university_student'>(() => {
     return currentUser?.role || 'parent';
  });

  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() => {
      return currentUser?.schoolId || null;
  });

  const isOwnerAccount = currentUser?.role === 'owner';
  const isSchoolOwner = currentUser?.role === 'school_owner';
  const isUniversityStudent = currentUser?.role === 'university_student';

  useEffect(() => {
    API.auth.setCurrentUserId(currentUser ? currentUser.id : null);
    if (currentUser && !isOwnerAccount && !isSchoolOwner && !isUniversityStudent && userRole === 'owner') {
        setUserRole('parent');
    }
  }, [currentUser, isOwnerAccount, isSchoolOwner, isUniversityStudent, userRole]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lopay_schools') setSchools(API.schools.list());
      if (e.key === 'lopay_children') setAllChildren(API.children.list());
      if (e.key === 'lopay_transactions') setAllTransactions(API.transactions.list());
      if (e.key === 'lopay_users') setAllUsers(API.users.list());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const childrenData = useMemo(() => {
    if (userRole === 'owner') return allChildren;
    if (userRole === 'school_owner') {
      const sId = activeSchoolId || currentUser?.schoolId;
      if (!sId) return [];
      const school = schools.find(s => s.id === sId);
      return allChildren.filter(c => c.school === school?.name);
    }
    return allChildren.filter(c => c.parentId === currentUser?.id);
  }, [allChildren, currentUser, userRole, schools, activeSchoolId]);

  const transactions = useMemo(() => {
    if (userRole === 'owner') return allTransactions;
    if (userRole === 'school_owner') {
      const sId = activeSchoolId || currentUser?.schoolId;
      if (!sId) return [];
      const school = schools.find(s => s.id === sId);
      return allTransactions.filter(t => t.schoolName === school?.name);
    }
    return allTransactions.filter(t => t.userId === currentUser?.id);
  }, [allTransactions, currentUser, userRole, schools, activeSchoolId]);

  const notifications = useMemo(() => {
    if (userRole === 'owner') return allNotifications;
    return allNotifications.filter(n => n.userId === currentUser?.id || !n.userId);
  }, [allNotifications, currentUser, userRole]);

  const login = (email: string, password?: string) => {
    const user = API.auth.login(email, password);
    if (user) {
        setCurrentUser(user);
        setUserRole(user.role);
        setActiveSchoolId(user.schoolId || null);
        return user;
    }
    return false;
  };

  const signup = (name: string, email: string, phoneNumber: string, password?: string, role: 'parent' | 'school_owner' | 'university_student' = 'parent', schoolId?: string, bankDetails?: { bankName: string, accountName: string, accountNumber: string }) => {
    const users = API.users.list();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return false;
    const newUser: User = {
        id: Date.now().toString(),
        name,
        email,
        phoneNumber,
        password,
        role,
        schoolId,
        ...bankDetails,
        createdAt: new Date().toISOString()
    };
    const updatedUsers = API.users.create(newUser);
    setAllUsers(updatedUsers);
    setCurrentUser(newUser);
    setUserRole(role);
    setActiveSchoolId(schoolId || null);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole('parent');
    setActiveSchoolId(null);
    API.auth.setCurrentUserId(null);
    window.location.href = '#/';
  };

  const switchRole = () => {
    if (currentUser?.role === 'owner') {
        const nextRole = userRole === 'owner' ? 'parent' : 'owner';
        setUserRole(nextRole);
    }
  };

  const setActingRole = (role: 'parent' | 'owner' | 'school_owner' | 'university_student', schoolId?: string) => {
      if (currentUser?.role !== 'owner') return; 
      setUserRole(role);
      if (schoolId) setActiveSchoolId(schoolId);
      else if (role === 'school_owner' && !activeSchoolId && schools.length > 0) {
          setActiveSchoolId(schools[0].id);
      }
  };

  const addSchool = (school: School) => {
    const updated = API.schools.add(school);
    setSchools(updated);
  };

  const updateSchool = (school: School) => {
    const updated = API.schools.update(school);
    setSchools(updated);
  };

  const deleteSchool = (schoolId: string) => {
    const updatedSchools = API.schools.delete(schoolId);
    setSchools(updatedSchools);
    setAllChildren(API.children.list());
    setAllTransactions(API.transactions.list());
  };

  const deleteAllSchools = () => {
      const updated = API.schools.deleteAll();
      setSchools(updated);
      setAllChildren(API.children.list());
      setAllTransactions(API.transactions.list());
  };

  const deleteUser = (userId: string) => {
    const updatedUsers = API.users.delete(userId);
    setAllUsers(updatedUsers);
    setAllChildren(API.children.list());
    setAllTransactions(API.transactions.list());
    setAllNotifications(API.notifications.list());
  };

  const addChild = (child: Omit<Child, 'parentId'>) => {
    if (!currentUser) return;
    const newChildWithId = { ...child, parentId: currentUser.id };
    const updated = API.children.add(newChildWithId);
    setAllChildren(updated);
  };

  const deleteChild = (childId: string) => {
    const updated = API.children.delete(childId);
    setAllChildren(updated);
    setAllTransactions(API.transactions.list());
  };

  const addTransaction = (transaction: Omit<Transaction, 'userId'>) => {
    const userId = currentUser ? currentUser.id : DEMO_USER_ID; 
    const newTx = { ...transaction, userId };
    const updated = API.transactions.add(newTx);
    setAllTransactions(updated);
  };

  const sendBroadcast = (title: string, message: string) => {
    const newNotif: Notification = {
        id: Date.now().toString(),
        type: 'announcement',
        title,
        message,
        timestamp: 'Just now',
        read: false,
        status: 'info'
    };
    const updated = API.notifications.add(newNotif);
    setAllNotifications(updated);
  };

  // Added logic to approve a pending payment and update child balance
  const approvePayment = (transactionId: string) => {
    const tx = allTransactions.find((t) => t.id === transactionId);
    if (!tx) return;

    const updatedTx = allTransactions.map((t) =>
      t.id === transactionId ? { ...t, status: 'Successful' as const } : t
    );
    API.transactions.updateAll(updatedTx);
    setAllTransactions(updatedTx);

    if (tx.childId) {
      const updatedChildren = allChildren.map((c) => {
        if (c.id === tx.childId) {
          const newPaid = c.paidAmount + tx.amount;
          const isComplete = newPaid >= c.totalFee;
          return {
            ...c,
            paidAmount: Math.min(newPaid, c.totalFee),
            status: isComplete ? 'Completed' : ('On Track' as any),
            nextInstallmentAmount: isComplete ? 0 : c.nextInstallmentAmount,
          };
        }
        return c;
      });
      API.children.updateAll(updatedChildren);
      setAllChildren(updatedChildren);
    }
  };

  // Added logic to decline a pending payment
  const declinePayment = (transactionId: string) => {
    const updatedTx = allTransactions.map((t) =>
      t.id === transactionId ? { ...t, status: 'Failed' as const } : t
    );
    API.transactions.updateAll(updatedTx);
    setAllTransactions(updatedTx);
  };

  const submitPayment = (childId: string, amount: number) => {
    const child = allChildren.find((c) => c.id === childId);
    if (!child) return;

    // Direct payment flow - no verification
    const newTrans: Transaction = {
        id: Date.now().toString(),
        userId: child.parentId,
        childId: child.id,
        childName: child.name,
        schoolName: child.school,
        amount: amount,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Successful'
    };

    const updatedTx = API.transactions.add(newTrans);
    setAllTransactions(updatedTx);

    // Update child balance immediately
    const updatedChildren = allChildren.map(c => {
        if (c.id === childId) {
            const newPaid = c.paidAmount + amount;
            const isComplete = newPaid >= c.totalFee;
            return {
                ...c,
                paidAmount: Math.min(newPaid, c.totalFee),
                status: isComplete ? 'Completed' : 'On Track' as any,
                nextInstallmentAmount: isComplete ? 0 : c.nextInstallmentAmount
            };
        }
        return c;
    });
    
    API.children.updateAll(updatedChildren);
    setAllChildren(updatedChildren);

    const newNotif: Notification = {
        id: Date.now().toString(),
        userId: child.parentId,
        type: 'payment',
        title: 'Payment Successful',
        message: `₦${amount.toLocaleString()} has been recorded for ${child.name}.`,
        timestamp: 'Just now',
        read: false,
        status: 'success'
    };
    const updatedNotifs = API.notifications.add(newNotif);
    setAllNotifications(updatedNotifs);
  };

  return (
    <AppContext.Provider
      value={{
        childrenData,
        transactions,
        notifications,
        schools,
        allUsers,
        addChild,
        deleteChild,
        addTransaction,
        submitPayment,
        addSchool,
        updateSchool,
        deleteSchool,
        deleteAllSchools,
        deleteUser,
        sendBroadcast,
        approvePayment,
        declinePayment,
        isAuthenticated,
        currentUser,
        userRole,
        activeSchoolId,
        isOwnerAccount,
        isSchoolOwner,
        isUniversityStudent,
        login,
        signup,
        logout,
        switchRole,
        setActingRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
