import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

export const AddChild: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    classGrade: '',
    school: '',
    totalFee: '',
    duration: '3 Months'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.id || 'classGrade']: e.target.value });
  };

  const handleNext = () => {
    if (!formData.name || !formData.totalFee) return; // Simple validation
    navigate('/calculator', { state: { ...formData, totalFee: Number(formData.totalFee) } });
  };

  return (
    <Layout>
      <div className="flex flex-col flex-1">
        <header className="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 p-4 pb-3 backdrop-blur-sm border-b border-transparent dark:border-slate-800">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">
              arrow_back
            </span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
            Add Child & Fee Details
          </h1>
        </header>

        <main className="flex-1 px-4 py-2">
        <section className="mb-6">
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] pb-2 pt-4">Child's Information</h2>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col">
              <p className="text-base font-medium leading-normal pb-2">Child's Full Name</p>
              <input 
                id="name"
                value={formData.name}
                onChange={handleChange}
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg focus:outline-0 focus:ring-2 focus:ring-primary-green/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 p-4 text-base" 
                placeholder="Enter their full name" 
              />
            </label>
            <label className="flex flex-col">
              <p className="text-base font-medium leading-normal pb-2">Class/Grade</p>
              <select 
                value={formData.classGrade}
                onChange={e => setFormData({...formData, classGrade: e.target.value})}
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg focus:outline-0 focus:ring-2 focus:ring-primary-green/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 px-4 text-base"
              >
                <option value="">Select class</option>
                <option value="reception1">Reception 1</option>
                <option value="basic1">Basic 1</option>
                <option value="jss1">JSS1</option>
                <option value="ss1">SS1</option>
              </select>
            </label>
            <label className="flex flex-col">
              <p className="text-base font-medium leading-normal pb-2">School Name</p>
              <input 
                id="school"
                value={formData.school}
                onChange={handleChange}
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg focus:outline-0 focus:ring-2 focus:ring-primary-green/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 p-4 text-base" 
                placeholder="Enter the school's name" 
              />
            </label>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] pb-2 pt-4">School Fee Details</h2>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col">
              <p className="text-base font-medium leading-normal pb-2">Total Term Fee</p>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-base">₦</span>
                <input 
                  id="totalFee"
                  type="number"
                  value={formData.totalFee}
                  onChange={handleChange}
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg focus:outline-0 focus:ring-2 focus:ring-primary-green/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 pl-10 pr-4 py-4 text-base" 
                  placeholder="0.00" 
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">Enter the full fee amount for the term.</p>
            </label>
            <div className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-base font-medium">Term Duration</p>
              <p className="text-base text-gray-500">3 Months</p>
            </div>
          </div>
        </section>
        </main>

        <footer className="sticky bottom-0 bg-background-light/95 dark:bg-background-dark/95 p-4 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleNext}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-primary-green text-slate-900 text-lg font-bold leading-normal transition-transform active:scale-95 shadow-sm hover:shadow-md"
          >
            Calculate Installment Plan
          </button>
        </footer>
      </div>
    </Layout>
  );
};
