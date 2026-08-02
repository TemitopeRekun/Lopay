
import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import { useUsers, useSchoolStudents, useDeleteUser } from '../../hooks/useQueries';

/**
 * Read-only directory of registered users, with delete as the only write.
 *
 * Rows used to be clickable to "impersonate" the user. That is gone: the acting
 * role it set never reached the server, so the parent dashboard it opened was
 * the admin's own session data labelled with someone else's name. Per-user
 * figures live in the admin breakdown screens, which read real data.
 */
const UsersListScreen: React.FC = () => {
  const { data: allUsers = [] } = useUsers();
  const { data: childrenData = [] } = useSchoolStudents();
  const { mutate: deleteUser } = useDeleteUser();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = allUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteUser = (id: string, name: string) => {
      if (window.confirm(`Are you sure you want to delete user "${name}"? This will also remove all their registered children and payment records. This action cannot be undone.`)) {
          deleteUser(id);
      }
  };

  return (
    <Layout>
      <Header title="User Directory" />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="mb-6 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..." 
                className="w-full pl-10 pr-10 py-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
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

        <div className="flex flex-col gap-4 pb-20">
            <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] px-1">Registered Users ({filteredUsers.length})</h3>
            
            {filteredUsers.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">person_off</span>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No users matching search</p>
                </div>
            ) : (
                filteredUsers.map(user => {
                    const childrenCount = childrenData.filter(c => c.parentId === user.id).length;

                    return (
                        <div
                            key={user.id}
                            className="bg-white dark:bg-card-dark p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`size-14 rounded-2xl flex items-center justify-center font-black text-white shrink-0 shadow-lg ${user.role === 'owner' ? 'bg-slate-900' : user.role === 'school_owner' ? 'bg-secondary' : 'bg-primary'}`}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-black text-sm text-text-primary-light dark:text-text-primary-dark truncate">{user.name}</p>
                                        {user.role === 'owner' && <span className="text-[8px] bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded-md font-black uppercase">PLATFORM ADMIN</span>}
                                        {user.role === 'school_owner' && <span className="text-[8px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-md font-black uppercase">BURSAR</span>}
                                    </div>
                                    <p className="text-[11px] text-text-secondary-light font-medium truncate">{user.email}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {user.role === 'parent' && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded-md">
                                                <span className="material-symbols-outlined text-[10px]">family_restroom</span>
                                                <span className="text-[9px] text-text-secondary-light font-black uppercase tracking-widest">
                                                    {childrenCount} {childrenCount === 1 ? 'Plan' : 'Plans'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="size-10 flex items-center justify-center text-text-secondary-light hover:text-danger hover:bg-danger/10 transition-all rounded-xl"
                                title="Delete User"
                            >
                                <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </Layout>
  );
};

export default UsersListScreen;
