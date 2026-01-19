
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useApp } from '../../context/AppContext';

const ManageFeesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, schools, updateSchool, activeSchoolId } = useApp();

  const mySchool = useMemo(() => {
    const sId = activeSchoolId || currentUser?.schoolId;
    return schools.find(s => s.id === sId);
  }, [schools, currentUser, activeSchoolId]);

  const GRADES = [
    'Reception 1', 'Reception 2', 
    'Nursery 1', 'Nursery 2', 
    'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5',
    'JSS1', 'JSS2', 'JSS3',
    'SS1', 'SS2', 'SS3'
  ];

  const [fees, setFees] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    GRADES.forEach(g => {
        // Fix: Explicitly cast to number | undefined to avoid 'unknown' type issues with indexing and handle 0 values correctly
        const val = mySchool?.feeStructure?.[g] as number | undefined;
        initial[g] = (val !== undefined && val !== null) ? String(val) : '';
    });
    return initial;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Fix: Explicitly type prev as Record<string, string> to avoid inference issues with state updates
  const handleFeeChange = (grade: string, value: string) => {
    setFees((prev: Record<string, string>) => ({ ...prev, [grade]: value.replace(/\D/g, '') }));
  };

  const handleSave = () => {
    if (!mySchool) return;
    setIsSaving(true);
    
    const numericFees: Record<string, number> = {};
    // Fix: Cast Object.entries result to [string, string][] to ensure 'val' is treated as string for parseInt
    (Object.entries(fees) as [string, string][]).forEach(([grade, val]) => {
        if (val) numericFees[grade] = parseInt(val, 10);
    });

    const updatedSchool = {
        ...mySchool,
        feeStructure: numericFees
    };

    updateSchool(updatedSchool);
    
    setTimeout(() => {
        setIsSaving(false);
        alert('Fee structure updated successfully!');
        navigate(-1);
    }, 800);
  };

  return (
    <Layout>
      <Header title="Manage Fee Structure" />
      <div className="flex-1 overflow-y-auto p-6 pb-32">
        <div className="mb-6 bg-primary/5 p-4 rounded-2xl border border-primary/20 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">info</span>
            <p className="text-xs text-primary-dark dark:text-primary leading-relaxed font-medium">
                Set the official tuition amount for each grade level. These prices will be locked for parents during registration.
            </p>
        </div>

        <div className="space-y-4">
            {GRADES.map((grade) => {
                const parts = grade.split(' ');
                const label = parts.length > 1 ? `${parts[0][0]}${parts[1]}` : grade;
                
                return (
                <div key={grade} className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 group focus-within:border-primary transition-all">
                    <div className="size-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-text-secondary-light uppercase group-focus-within:text-primary">{label}</span>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest block mb-1">{grade}</label>
                        <div className="relative">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₦</span>
                            <input 
                                type="text"
                                value={fees[grade]}
                                onChange={(e) => handleFeeChange(grade, e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-transparent border-none p-0 pl-4 outline-none font-bold text-text-primary-light dark:text-text-primary-dark text-lg"
                            />
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 z-30 pb-safe">
        <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-14 bg-primary text-white rounded-xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
        >
            {isSaving ? (
                <>
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Saving Changes...
                </>
            ) : (
                <>
                    <span className="material-symbols-outlined text-xl">save</span>
                    Publish Fees
                </>
            )}
        </button>
      </div>
    </Layout>
  );
};

export default ManageFeesScreen;
