
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Layout } from '../components/Layout';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [roleSelection, setRoleSelection] = useState<'parent' | 'school_owner' | 'university_student'>('parent');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Bank details for school owners
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  const { login, signup, schools, isAuthenticated, userRole } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect away from Auth screen immediately
  useEffect(() => {
    if (isAuthenticated) {
        if (userRole === 'owner') navigate('/owner-dashboard', { replace: true });
        else if (userRole === 'school_owner') navigate('/school-owner-dashboard', { replace: true });
        else navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, userRole, navigate]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (mode === 'signup' && roleSelection === 'school_owner') {
        if (!selectedSchoolId) {
            setError('Please select the school you own.');
            return;
        }
        if (!bankName || !accountName || !accountNumber) {
            setError('Please provide complete banking details for settlements.');
            return;
        }
    }
    
    if (mode === 'login') {
        const user = login(email, password);
        if (user) {
            if (user.role === 'owner') navigate('/owner-dashboard', { replace: true });
            else if (user.role === 'school_owner') navigate('/school-owner-dashboard', { replace: true });
            else navigate('/dashboard', { replace: true });
        } else {
            setError('Invalid email or password. Please try again.');
        }
    } else {
        const bankDetails = roleSelection === 'school_owner' ? { bankName, accountName, accountNumber } : undefined;
        const success = signup(fullName, email, password, roleSelection, selectedSchoolId, bankDetails);
        if (success) {
            if (roleSelection === 'school_owner') navigate('/school-owner-dashboard', { replace: true });
            else navigate('/dashboard', { replace: true });
        } else {
            setError('Email already registered.');
        }
    }
  };

  const roleOptions = [
    { 
        id: 'parent', 
        title: 'Parent', 
        desc: 'Paying for my child in Primary/Secondary school', 
        icon: 'family_restroom', 
        color: 'bg-primary' 
    },
    { 
        id: 'university_student', 
        title: 'Student', 
        desc: 'Paying for my own university tuition', 
        icon: 'school', 
        color: 'bg-purple-500' 
    },
    { 
        id: 'school_owner', 
        title: 'School Owner', 
        desc: 'I want to manage fee collections for my institution', 
        icon: 'account_balance', 
        color: 'bg-secondary' 
    },
  ] as const;

  return (
    <Layout>
      <div className="flex flex-col grow px-6 py-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-4xl text-primary filled">account_balance</span>
            <h1 className="text-3xl font-extrabold tracking-tight">LOPAY</h1>
          </div>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium">
            Smart School Fee Management
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl mb-8">
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'signup' ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
          >
            Create Account
          </button>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
          >
            Sign In
          </button>
        </div>

        {/* Account Type Selection (Signup Only) */}
        {mode === 'signup' && (
          <div className="space-y-4 mb-8">
            <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-widest px-1">Choose Account Type</h2>
            <div className="grid grid-cols-1 gap-3">
              {roleOptions.map((opt) => {
                const isSelected = roleSelection === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRoleSelection(opt.id)}
                    className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                        isSelected 
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' 
                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-card-dark hover:border-gray-200'
                    }`}
                  >
                    <div className={`size-12 rounded-full flex items-center justify-center text-white shrink-0 ${opt.color} ${isSelected ? 'scale-110 shadow-lg' : 'opacity-80'}`}>
                      <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${isSelected ? 'text-primary' : 'text-text-primary-light dark:text-text-primary-dark'}`}>{opt.title}</p>
                      <p className="text-xs text-text-secondary-light leading-snug">{opt.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <span className="material-symbols-outlined text-primary text-xl filled">check_circle</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary-light uppercase px-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Michael Brown"
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
          )}

          {mode === 'signup' && (roleSelection === 'school_owner' || roleSelection === 'university_student') && (
            <div className="space-y-1.5 animate-fade-in-up">
              <label className="text-xs font-bold text-text-secondary-light uppercase px-1">Select Institution</label>
              <select 
                required
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/50 text-base appearance-none"
              >
                <option value="" disabled>Choose your school...</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {mode === 'signup' && roleSelection === 'school_owner' && (
             <div className="p-5 bg-secondary/5 rounded-2xl border border-secondary/20 space-y-4 animate-fade-in-up">
                <p className="text-[10px] font-extrabold text-secondary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Settlement Bank Account
                </p>
                <div className="space-y-3">
                    <input
                        type="text"
                        required
                        placeholder="Bank Name (e.g. Opay, Zenith)"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"
                    />
                    <input
                        type="text"
                        required
                        placeholder="Account Number"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"
                    />
                    <input
                        type="text"
                        required
                        placeholder="Full Account Holder Name"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"
                    />
                </div>
             </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary-light uppercase px-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/50 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary-light uppercase px-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 pr-12 outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-danger/10 text-danger text-sm font-bold text-center animate-bounce">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full h-16 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {mode === 'signup' ? 'Create My Account' : 'Sign In to LOPAY'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-4">
            <p className="text-xs text-text-secondary-light">
                By continuing, you agree to our <Link to="/terms" className="text-primary font-bold">Terms</Link> and <Link to="/privacy" className="text-primary font-bold">Privacy Policy</Link>.
            </p>
            
            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest mb-2">Test Credentials</p>
                <div className="flex justify-center gap-4 text-[10px] font-medium">
                    <span className="text-secondary font-bold">owner@febison.com / owner</span>
                    <span className="text-primary font-bold">demo@lopay.app / demo</span>
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default AuthScreen;
