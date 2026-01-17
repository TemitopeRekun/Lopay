
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useApp } from '../../context/AppContext';

const SchoolListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { schools, deleteSchool, updateSchool, deleteAllSchools, setActingRole } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    school.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${name}?\n\nWARNING: This will permanently remove all students and payment records linked to this school.`)) {
      deleteSchool(id);
    }
  };

  const handleDeleteAll = () => {
      if (window.confirm("ARE YOU SURE YOU WANT TO DELETE ALL SCHOOLS?\n\nThis action is irreversible and will wipe all school data, students, and transaction history from the platform.")) {
          if (window.confirm("Please confirm one last time. Delete EVERYTHING?")) {
              deleteAllSchools();
          }
      }
  };

  const handleEditCount = (e: React.MouseEvent, school: any) => {
      e.stopPropagation();
      const newCountStr = window.prompt(`Update student count for ${school.name}:`, school.studentCount?.toString());
      if (newCountStr !== null) {
          const newCount = parseInt(newCountStr);
          if (!isNaN(newCount) && newCount >= 0) {
              updateSchool({ ...school, studentCount: newCount });
          } else {
              alert("Please enter a valid number.");
          }
      }
  };

  const handleManageSchool = (schoolId: string) => {
      setActingRole('school_owner', schoolId);
      navigate('/school-owner-dashboard');
  };

  return (
    <Layout>
      <Header title="All Registered Schools" />
      <div className="flex flex-col flex-1 p-6 gap-6 overflow-y-auto">
        
        {/* Search & Add */}
        <div className="flex flex-col gap-4">
             <div className="relative">
                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                 <input 
                    type="text" 
                    placeholder="Search schools..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-10 outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                 />
                 {searchQuery && (
                    <button 
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                 )}
             </div>
             
             <div className="flex gap-2">
                <button 
                    onClick={() => navigate('/admin/add-school')}
                    className="flex-1 flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined">add_business</span>
                    Add New
                </button>
                {schools.length > 0 && (
                    <button 
                        onClick={handleDeleteAll}
                        className="flex items-center justify-center gap-2 px-4 bg-danger/10 text-danger border border-danger/20 rounded-xl font-bold hover:bg-danger/20 transition-colors"
                        title="Delete All Schools"
                    >
                        <span className="material-symbols-outlined">delete_forever</span>
                    </button>
                )}
             </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-4 pb-20">
            {filteredSchools.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p>No schools found.</p>
                </div>
            ) : (
                filteredSchools.map((school) => (
                    <div key={school.id} className="bg-white dark:bg-card-dark p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">school</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">{school.name}</h3>
                                    <p className="text-sm text-text-secondary-light">{school.address}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={(e) => handleEditCount(e, school)}
                                    className="p-2 text-text-secondary-light hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Edit Student Count"
                                >
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-1"></div>
                                <button 
                                    type="button"
                                    onClick={(e) => handleDelete(e, school.id, school.name)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-danger/5 hover:bg-danger/10 text-danger rounded-lg transition-colors"
                                    title="Delete School"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 mt-1">
                            <div>
                                <p className="text-[10px] text-text-secondary-light uppercase font-bold">Contact Email</p>
                                <p className="text-sm truncate">{school.contactEmail}</p>
                            </div>
                            <div className="text-right">
                                <button 
                                    onClick={() => handleManageSchool(school.id)}
                                    className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-all"
                                >
                                    Manage Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </Layout>
  );
};

export default SchoolListScreen;
