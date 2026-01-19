
import { Child, Notification, School, Transaction, User } from '../types';

const KEYS = {
  USERS: 'lopay_users',
  SCHOOLS: 'lopay_schools',
  CHILDREN: 'lopay_children',
  TRANSACTIONS: 'lopay_transactions',
  NOTIFICATIONS: 'lopay_notifications',
  CURRENT_USER_ID: 'lopay_current_user_id',
};

const get = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error(`Error reading ${key} from storage`, e);
    return null;
  }
};

const set = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to storage`, e);
  }
};

const DEMO_USER_ID = 'user-demo-1';

export const API = {
  init: () => {
    try {
        let users = get<User[]>(KEYS.USERS) || [];
        const adminEmail = 'admin@lopay.app';
        const demoEmail = 'demo@lopay.app';
        const febisonEmail = 'owner@febison.com';
        const westhillsEmail = 'bursar@westhills.edu.ng';
        const inglewoodEmail = 'accounts@inglewood.edu.ng';

        const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
        let needsUpdate = false;

        const addIfMissing = (user: User) => {
            const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
            if (existingIdx === -1) {
                users.push(user);
                needsUpdate = true;
            } else {
                const current = users[existingIdx];
                if (current.id === user.id && (current.accountNumber !== user.accountNumber || current.bankName !== user.bankName)) {
                    users[existingIdx] = { ...current, ...user };
                    needsUpdate = true;
                }
            }
        };

        addIfMissing({
            id: 'admin-1',
            name: 'System Admin',
            email: adminEmail,
            password: 'admin',
            role: 'owner',
            createdAt: new Date().toISOString()
        });

        addIfMissing({
            id: DEMO_USER_ID,
            name: 'Demo Parent',
            email: demoEmail,
            password: 'demo',
            role: 'parent',
            createdAt: new Date().toISOString()
        });

        addIfMissing({
            id: 'school-owner-1',
            name: 'Febison Bursar',
            email: febisonEmail,
            password: 'owner',
            role: 'school_owner',
            schoolId: 'sch_febison',
            bankName: 'Moniepoint',
            accountName: 'Febison Montessori School',
            accountNumber: '9090390581',
            createdAt: new Date().toISOString()
        });

        addIfMissing({
            id: 'school-owner-2',
            name: 'Okafor Nonso',
            email: westhillsEmail,
            password: 'bursar',
            role: 'school_owner',
            schoolId: 'sch_westhills',
            bankName: 'Access Bank',
            accountName: 'Okafor Nonso',
            accountNumber: '1101010101',
            createdAt: new Date().toISOString()
        });

        addIfMissing({
            id: 'school-owner-3',
            name: 'Inglewood school',
            email: inglewoodEmail,
            password: 'finance',
            role: 'school_owner',
            schoolId: 'sch_inglewood',
            bankName: 'UBA',
            accountName: 'Inglewood school',
            accountNumber: '8130311200',
            createdAt: new Date().toISOString()
        });
        
        if (needsUpdate || !get(KEYS.USERS)) {
            set(KEYS.USERS, users);
        }

        const currentSchools = get<School[]>(KEYS.SCHOOLS);
        if (!currentSchools || currentSchools.length === 0) {
            const defaultSchools: School[] = [
                {
                    id: 'sch_febison',
                    name: 'Febison Montessori Groomers School',
                    address: '106, C.A.C Agbeye Junction, Eyita, Ikorodu, Lagos',
                    contactEmail: 'info@febison.edu.ng',
                    studentCount: 45,
                    feeStructure: {
                        'Basic 1': 120000,
                        'Basic 2': 120000,
                        'Basic 3': 125000,
                        'Basic 4': 130000,
                        'JSS1': 180000,
                        'SS1': 220000
                    }
                },
                {
                    id: 'sch_westhills',
                    name: 'Westhills School',
                    address: 'Westhills avenue, Eyita, Ikorodu, Lagos',
                    contactEmail: 'admin@westhills.edu.ng',
                    studentCount: 30,
                    feeStructure: {
                        'Reception 1': 85000,
                        'Nursery 1': 90000,
                        'Basic 1': 110000
                    }
                },
                {
                    id: 'sch_inglewood',
                    name: 'Inglewood School',
                    address: 'Oshewa street, Ori-Okuta, Ikorodu, Lagos',
                    contactEmail: 'contact@inglewood.edu.ng',
                    studentCount: 22,
                    feeStructure: {
                        'JSS1': 150000,
                        'JSS2': 155000,
                        'JSS3': 160000
                    }
                }
            ];
            set(KEYS.SCHOOLS, defaultSchools);
        }

        if (localStorage.getItem(KEYS.CHILDREN) === null) set(KEYS.CHILDREN, []);
        if (localStorage.getItem(KEYS.TRANSACTIONS) === null) set(KEYS.TRANSACTIONS, []);
        if (localStorage.getItem(KEYS.NOTIFICATIONS) === null) set(KEYS.NOTIFICATIONS, []);
    } catch (e) {
        console.error("API Initialization failed", e);
    }
  },

  auth: {
    getCurrentUserId: () => localStorage.getItem(KEYS.CURRENT_USER_ID),
    setCurrentUserId: (id: string | null) => {
      if (id) localStorage.setItem(KEYS.CURRENT_USER_ID, id);
      else localStorage.removeItem(KEYS.CURRENT_USER_ID);
    },
    login: (email: string, password?: string): User | null => {
      const users = get<User[]>(KEYS.USERS) || [];
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user && user.password === password) return user;
      return null;
    },
    getUserById: (id: string): User | null => {
      const users = get<User[]>(KEYS.USERS) || [];
      return users.find(u => u.id === id) || null;
    }
  },

  users: {
    list: () => get<User[]>(KEYS.USERS) || [],
    create: (user: User) => {
      const users = get<User[]>(KEYS.USERS) || [];
      const updated = [...users, user];
      set(KEYS.USERS, updated);
      return updated;
    },
    update: (user: User) => {
      const users = get<User[]>(KEYS.USERS) || [];
      const updated = users.map(u => u.id === user.id ? user : u);
      set(KEYS.USERS, updated);
      return updated;
    },
    delete: (id: string) => {
      const users = get<User[]>(KEYS.USERS) || [];
      const updatedUsers = users.filter(u => u.id !== id);
      set(KEYS.USERS, updatedUsers);
      const children = get<Child[]>(KEYS.CHILDREN) || [];
      const updatedChildren = children.filter(c => c.parentId !== id);
      set(KEYS.CHILDREN, updatedChildren);
      const transactions = get<Transaction[]>(KEYS.TRANSACTIONS) || [];
      const updatedTransactions = transactions.filter(t => t.userId !== id);
      set(KEYS.TRANSACTIONS, updatedTransactions);
      const notifications = get<Notification[]>(KEYS.NOTIFICATIONS) || [];
      const updatedNotifications = notifications.filter(n => n.userId !== id);
      set(KEYS.NOTIFICATIONS, updatedNotifications);
      return updatedUsers;
    }
  },

  schools: {
    list: () => get<School[]>(KEYS.SCHOOLS) || [],
    add: (school: School) => {
      const schools = get<School[]>(KEYS.SCHOOLS) || [];
      const updated = [school, ...schools];
      set(KEYS.SCHOOLS, updated);
      return updated;
    },
    update: (school: School) => {
      const schools = get<School[]>(KEYS.SCHOOLS) || [];
      const updated = schools.map(s => s.id === school.id ? school : s);
      set(KEYS.SCHOOLS, updated);
      return updated;
    },
    delete: (id: string) => {
      const schools = get<School[]>(KEYS.SCHOOLS) || [];
      const schoolToDelete = schools.find(s => s.id === id);
      const updatedSchools = schools.filter(s => s.id !== id);
      set(KEYS.SCHOOLS, updatedSchools);
      if (schoolToDelete) {
          const schoolName = schoolToDelete.name;
          const children = get<Child[]>(KEYS.CHILDREN) || [];
          const updatedChildren = children.filter(c => c.school === schoolName);
          set(KEYS.CHILDREN, updatedChildren);
          const transactions = get<Transaction[]>(KEYS.TRANSACTIONS) || [];
          const updatedTransactions = transactions.filter(t => t.schoolName === schoolName);
          set(KEYS.TRANSACTIONS, updatedTransactions);
      }
      return updatedSchools;
    },
    deleteAll: () => {
      set(KEYS.SCHOOLS, []);
      set(KEYS.CHILDREN, []);
      set(KEYS.TRANSACTIONS, []);
      return [];
    }
  },

  children: {
    list: () => get<Child[]>(KEYS.CHILDREN) || [],
    add: (child: Child) => {
      const children = get<Child[]>(KEYS.CHILDREN) || [];
      const updated = [...children, child];
      set(KEYS.CHILDREN, updated);
      return updated;
    },
    updateAll: (children: Child[]) => {
      set(KEYS.CHILDREN, children);
      return children;
    },
    delete: (id: string) => {
      const children = get<Child[]>(KEYS.CHILDREN) || [];
      const updated = children.filter(c => c.id !== id);
      set(KEYS.CHILDREN, updated);
      const transactions = get<Transaction[]>(KEYS.TRANSACTIONS) || [];
      const updatedTx = transactions.filter(t => t.childId !== id);
      set(KEYS.TRANSACTIONS, updatedTx);
      return updated;
    }
  },

  transactions: {
    list: () => get<Transaction[]>(KEYS.TRANSACTIONS) || [],
    add: (transaction: Transaction) => {
      const list = get<Transaction[]>(KEYS.TRANSACTIONS) || [];
      const updated = [transaction, ...list];
      set(KEYS.TRANSACTIONS, updated);
      return updated;
    },
    updateAll: (transactions: Transaction[]) => {
      set(KEYS.TRANSACTIONS, transactions);
      return transactions;
    }
  },

  notifications: {
    list: () => get<Notification[]>(KEYS.NOTIFICATIONS) || [],
    add: (notification: Notification) => {
      const list = get<Notification[]>(KEYS.NOTIFICATIONS) || [];
      const updated = [notification, ...list];
      set(KEYS.NOTIFICATIONS, updated);
      return updated;
    }
  }
};

API.init();
