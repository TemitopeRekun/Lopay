
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { BackendAPI } from '../../services/backend';
import { useApp } from '../../context/AppContext';

const AddSchoolScreen: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSchools } = useApp();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !ownerName || !bankName || !accountName || !accountNumber) return;

    setIsSubmitting(true);

    try {
        await BackendAPI.admin.onboardSchool({
            schoolName: name,
            ownerEmail: email,
            ownerPassword: password,
            ownerName: ownerName,
            address: address,
            phone: phone,
            bankName: bankName,
            accountName: accountName,
            accountNumber: accountNumber
        });
        
        await refreshSchools();

        setTimeout(() => {
            setIsSubmitting(false);
            alert('School onboarded successfully!');
            navigate('/owner-dashboard');
        }, 500);
    } catch (error: any) {
        console.error("Failed to onboard school", error);
        alert(error.response?.data?.message || "Failed to onboard school");
        setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Header title="Add New School" />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 gap-6">
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">School Name</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Lagos International School"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Address</label>
              <input 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. 15 Victoria Island"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Owner Name</label>
              <input 
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Dr. John Doe"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Owner Email (Login Email)</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="admin@school.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Owner Password</label>
              <input 
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Set a secure password"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Phone Number</label>
              <input 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="08012345678"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Bank Name</label>
              <input 
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. GTBank"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Account Name</label>
              <input 
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Lagos International School"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">Account Number</label>
              <input 
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="0123456789"
                required
                disabled={isSubmitting}
              />
            </div>
        </div>

        <button 
            type="submit"
            disabled={isSubmitting}
            className="mt-auto w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
        >
            {isSubmitting ? (
                <div className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Saving...</span>
                </div>
            ) : (
                'Onboard School'
            )}
        </button>
      </form>
    </Layout>
  );
};

export default AddSchoolScreen;
