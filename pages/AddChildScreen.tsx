
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

const ALL_GRADES = [
  'Reception 1', 'Reception 2', 
  'Nursery 1', 'Nursery 2', 
  'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5',
  'JSS1', 'JSS2', 'JSS3',
  'SS1', 'SS2', 'SS3'
];

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
        if (currentUser.schoolId) {
            const linkedSchool = schools.find(s => s.id === currentUser.schoolId);
            if (linkedSchool) setSchool(linkedSchool.name);
        }
    }
  }, [isStudent, currentUser, schools]);

  const sortedSchools = [...schools].sort((a, b) => a.name.localeCompare(b.name));

  const selectedSchoolObj = useMemo(() => {
    return schools.find(s => s.name === school);
  }, [schools, school]);

  // Update locked fee whenever level or school changes
  useEffect(() => {
      if (!isStudent && selectedSchoolObj?.feeStructure && level) {
          const lockedFee = selectedSchoolObj.feeStructure[level];
          if (lockedFee) {
              setFee(lockedFee.toString());
          } else {
              setFee('');
          }
      } else if (!isStudent) {
          setFee('');
      }
  }, [selectedSchoolObj, level, isStudent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !fee || !school) return;
    
    const gradeDisplay = isStudent 
        ? `${level} Level - ${feeType === 'Semester' ? semester : 'Full Session'}`
        : level;

    navigate('/calculator', { 
        state: { 
            childName: name,
            schoolName: school,
            grade: gradeDisplay,
            totalFee: parseFloat(fee),
            feeType: isStudent ? feeType : 'Semester'
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
                onChange={(e) => {
                    setSchool(e.target.value);
                    setLevel('');
                    setFee('');
                }}
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
                        className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none disabled:opacity-50"
                        required
                        disabled={!school && !isStudent}
                    >
                        <option value="" disabled>{isStudent ? 'Select level' : 'Select grade'}</option>
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
                            ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)
                        )}
                    </select>
                    {!isStudent && school && level && !fee && (
                        <p className="text-[10px] text-danger font-bold uppercase mt-1">This school has not published a fee for this grade.</p>
                    )}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {isStudent ? 'Fee Amount' : 'School Fee Details'}
            </h2>
            {!isStudent && fee && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full">
                    <span className="material-symbols-outlined text-sm filled">verified</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Verified Fee</span>
                </div>
            )}
          </div>
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
                    onChange={(e) => isStudent ? setFee(e.target.value) : null}
                    readOnly={!isStudent}
                    className={`input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4 pl-10 outline-none transition-all font-bold text-lg ${!isStudent ? 'bg-gray-100 dark:bg-white/10 text-text-primary-light' : 'bg-background-light dark:bg-background-dark focus:ring-2 focus:ring-primary'}`}
                    placeholder={!isStudent ? "Select grade to view fee" : "0.00"}
                    required
                />
              </div>
              {!isStudent && (
                  <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest px-1">Fee is locked and verified by the school.</p>
              )}
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
             disabled={sortedSchools.length === 0 || !fee || parseFloat(fee) <= 0}
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
