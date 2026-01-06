
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

const AddChildScreen: React.FC = () => {
  const navigate = useNavigate();
  const { schools, userRole, currentUser } = useApp();
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [level, setLevel] = useState('');
  const [feeType, setFeeType] = useState<'Semester' | 'Session'>('Semester');
  const [semester, setSemester] = useState('1st Semester');
  const [fee, setFee] = useState('');

  const isStudent = userRole === 'university_student';

  useEffect(() => {
    if (isStudent && currentUser) {
        setName(currentUser.name);
        // Pre-select school if linked
        if (currentUser.schoolId) {
            const linkedSchool = schools.find(s => s.id === currentUser.schoolId);
            if (linkedSchool) setSchool(linkedSchool.name);
        }
    }
  }, [isStudent, currentUser, schools]);

  // Sort schools alphabetically for better UX
  const sortedSchools = [...schools].sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !fee || !school) return;
    
    // Construct the display grade/level string
    const gradeDisplay = isStudent 
        ? `${level} Level - ${feeType === 'Semester' ? semester : 'Full Session'}`
        : level; // In parent mode, 'level' state actually holds the grade

    // Navigate to calculator to plan the payment
    navigate('/calculator', { 
        state: { 
            childName: name,
            schoolName: school,
            grade: gradeDisplay,
            totalFee: parseFloat(fee),
            feeType: isStudent ? feeType : 'Semester' // Default parents to 3 months (Semester logic)
        } 
    });
  };

  const planDuration = (isStudent && feeType === 'Session') ? '7 Months' : '3 Months';

  return (
    <Layout>
      <Header title={isStudent ? "Tuition Details" : "Add Child & Fee Details"} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 gap-6">
        
        <section>
          <h2 className="text-lg font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {isStudent ? 'Academic Information' : "Child's Information"}
          </h2>
          <div className="space-y-4">
            {!isStudent && (
                <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary-light">Child's Full Name</label>
                <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Michael Brown"
                    required
                />
                </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">
                {isStudent ? 'University/Institution' : 'School Name'}
              </label>
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none"
                required
              >
                <option value="" disabled>Select Institution</option>
                {sortedSchools.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {isStudent && (
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary-light">Fee Schedule</label>
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                        <button 
                            type="button"
                            onClick={() => setFeeType('Semester')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${feeType === 'Semester' ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
                        >
                            Per Semester
                        </button>
                        <button 
                            type="button"
                            onClick={() => setFeeType('Session')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${feeType === 'Session' ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
                        >
                            Full Session
                        </button>
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary-light">
                        {isStudent ? 'Current Level' : 'Class/Grade'}
                    </label>
                    <select 
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none"
                        required
                    >
                        <option value="" disabled>{isStudent ? 'Select level' : 'Select class'}</option>
                        {isStudent ? (
                            <>
                                <option value="100">100 Level</option>
                                <option value="200">200 Level</option>
                                <option value="300">300 Level</option>
                                <option value="400">400 Level</option>
                                <option value="500">500 Level</option>
                                <option value="600">600 Level</option>
                                <option value="Post-Grad">Post-Graduate</option>
                            </>
                        ) : (
                            <>
                                <option value="Reception 1">Reception 1</option>
                                <option value="Reception 2">Reception 2</option>
                                <option value="Nursery 1">Nursery 1</option>
                                <option value="Nursery 2">Nursery 2</option>
                                <option value="Basic 1">Basic 1</option>
                                <option value="Basic 2">Basic 2</option>
                                <option value="Basic 3">Basic 3</option>
                                <option value="Basic 4">Basic 4</option>
                                <option value="Basic 5">Basic 5</option>
                                <option value="JSS 1">JSS 1</option>
                                <option value="JSS 2">JSS 2</option>
                                <option value="JSS 3">JSS 3</option>
                                <option value="SS 1">SS 1</option>
                                <option value="SS 2">SS 2</option>
                                <option value="SS 3">SS 3</option>
                            </>
                        )}
                    </select>
                </div>

                {isStudent && feeType === 'Semester' && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary-light">Semester</label>
                        <select 
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none"
                            required
                        >
                            <option value="1st Semester">1st Semester</option>
                            <option value="2nd Semester">2nd Semester</option>
                        </select>
                    </div>
                )}

                {isStudent && feeType === 'Session' && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary-light">Coverage</label>
                        <div className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center px-4">
                            <span className="text-sm font-bold text-primary">Full Academic Session</span>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {isStudent ? 'Fee Amount' : 'School Fee Details'}
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary-light">
                {feeType === 'Session' ? 'Total Session Fee' : 'Total Amount'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
                <input 
                    type="number"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 pl-10 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                    placeholder="0.00"
                    required
                />
              </div>
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center transition-all">
                <span className="font-medium text-primary-dark dark:text-primary">Plan Duration</span>
                <span className="font-bold text-primary-dark dark:text-primary">{planDuration}</span>
            </div>
          </div>
        </section>

        <div className="mt-auto pt-4">
           <button 
             type="submit"
             disabled={sortedSchools.length === 0}
             className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
           >
             Calculate Installment Plan
           </button>
        </div>
      </form>
    </Layout>
  );
};

export default AddChildScreen;
