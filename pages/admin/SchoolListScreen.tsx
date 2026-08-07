
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Header } from '../../components/Header';
import {
  useSchools,
  useDeleteSchool,
  useDeleteAllSchools,
  useSchoolsPayoutStatus,
  useRetrySchoolPayoutSetup,
} from '../../hooks/useQueries';
import { useUIStore } from '../../store/uiStore';
import type { SchoolPayoutState, SchoolPayoutStatus } from '../../types.admin';

/**
 * How each payout verdict renders.
 *
 * ACTIVE is deliberately quiet — a green tick on every row trains admins to stop
 * reading the column. Only the states that need a human get visual weight, and
 * UNKNOWN (Paystack unreachable) is styled as a caution rather than a failure so
 * an outage doesn't provoke a re-provision of a healthy school.
 */
const PAYOUT_BADGE: Record<
  SchoolPayoutState,
  { label: string; icon: string; className: string } | null
> = {
  ACTIVE: null,
  MISSING: {
    label: 'Payouts not set up',
    icon: 'error',
    className: 'bg-danger/10 text-danger border-danger/20',
  },
  NOT_ON_INTEGRATION: {
    label: 'Payout account invalid',
    icon: 'error',
    className: 'bg-danger/10 text-danger border-danger/20',
  },
  UNKNOWN: {
    label: 'Payout status unknown',
    icon: 'help',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
};

const SchoolListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data: schools = [] } = useSchools();
  const { data: payoutStatuses = [] } = useSchoolsPayoutStatus();
  const { mutate: deleteSchool } = useDeleteSchool();
  const { mutate: deleteAllSchools } = useDeleteAllSchools();
  const { mutate: retryPayoutSetup, isPending: isRetrying, variables: retryingSchoolId } =
    useRetrySchoolPayoutSetup();
  const { showToast } = useUIStore();

  const payoutBySchool = new Map<string, SchoolPayoutStatus>(
    payoutStatuses.map((status) => [status.schoolId, status]),
  );

  /*
   * Repairing a payout account moves where a school's money settles, so the
   * confirm spells out the consequence rather than asking "are you sure?".
   */
  const handleRetryPayout = (status: SchoolPayoutStatus) => {
    if (
      !window.confirm(
        `Set up payouts for ${status.schoolName}?\n\nThis creates the school's payout account with Paystack using the settlement bank details already on file. An account that is still valid is kept as-is.`,
      )
    ) {
      return;
    }
    retryPayoutSetup(status.schoolId, {
      onSuccess: (result) => {
        showToast(
          result.created
            ? `Payout account created for ${status.schoolName}. Parents can now pay this school.`
            : `${status.schoolName} already had a valid payout account — nothing was changed.`,
          'success',
        );
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          'Could not set up payouts. Please try again.';
        showToast(
          `Payout setup failed: ${Array.isArray(message) ? message.join(', ') : message}`,
          'error',
        );
      },
    });
  };

  const [searchQuery, setSearchQuery] = useState('');

  /*
   * Name only. `GET /schools` is the PUBLIC directory and returns `{ id, name }`
   * — a school address, email and phone are PII and deliberately not harvestable
   * from an open endpoint. The address clause could therefore never match
   * (normalizeSchool defaults it to ""), and the card below rendered two
   * permanently blank fields under real-looking labels.
   */
  const filteredSchools = schools.filter((school) =>
    school.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    /*
     * Says what actually happens. `deleteSchool` is a SOFT delete: it stamps
     * `deletedAt`, anonymises the owner email and revokes their sessions.
     * Enrolments and payments are untouched — a ledger is not something a list
     * screen deletes. The old copy promised to "permanently remove all students
     * and payment records", which was both false and the scarier claim.
     */
    if (
      window.confirm(
        `Delist ${name}?\n\nThe school stops appearing to parents and its owner loses access. Existing enrolments and payment records are kept for audit.`,
      )
    ) {
      deleteSchool(id);
    }
  };

  const handleDeleteAll = () => {
      if (
        window.confirm(
          `Delist ALL ${schools.length} schools?\n\nEvery school stops appearing to parents and every owner loses access. Enrolments and payment records are kept for audit.`,
        )
      ) {
          if (window.confirm("Please confirm one last time. Delist every school?")) {
              deleteAllSchools();
          }
      }
  };

  // "Edit student count" used to live here. It was a no-op: School has no
  // studentCount column and UpdateSchoolDto no such field, so the value was
  // stripped by the whitelisting ValidationPipe and the PATCH silently
  // succeeded. Student counts are derived from enrollments — see the
  // collections breakdown screen for the real per-school figures.

  /**
   * Opens this school's students in the admin breakdown.
   *
   * Replaces a "Manage Dashboard" button that called setActingRole and pushed
   * the admin at /school-owner-dashboard. Acting role is UI-only, so every
   * school-scoped request there still carried SUPER_ADMIN and 403'd against the
   * SCHOOL_OWNER-only endpoints. This route reads real admin data instead.
   */
  const handleViewStudents = (schoolId: string) => {
      navigate('/admin/breakdown', { state: { tab: 'students', schoolId } });
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
                filteredSchools.map((school) => {
                  const payout = payoutBySchool.get(school.id);
                  const badge = payout ? PAYOUT_BADGE[payout.state] : null;
                  return (
                    <div key={school.id} className="bg-white dark:bg-card-dark p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">school</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">{school.name}</h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
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
                        
                        {/*
                          Payout health, verified against Paystack rather than
                          read from our own column. A school whose payout account
                          was created in test mode reported itself perfectly
                          healthy in the database until a parent's card was
                          refused — this row is the only place that mismatch is
                          visible before it costs someone a payment.
                        */}
                        {badge && payout && (
                            <div className={`flex flex-col gap-2 p-3 rounded-lg border ${badge.className}`}>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">{badge.icon}</span>
                                    <span className="text-[10px] font-black uppercase tracking-wider">{badge.label}</span>
                                </div>
                                <p className="text-xs leading-snug opacity-90">{payout.detail}</p>
                                {payout.canRetry && payout.state !== 'UNKNOWN' && (
                                    <button
                                        type="button"
                                        onClick={() => handleRetryPayout(payout)}
                                        disabled={isRetrying && retryingSchoolId === school.id}
                                        className="self-start text-[10px] font-black uppercase bg-white/60 dark:bg-black/20 px-3 py-2 rounded-lg hover:bg-white/90 dark:hover:bg-black/40 transition-all disabled:opacity-50"
                                    >
                                        {isRetrying && retryingSchoolId === school.id
                                            ? 'Setting up…'
                                            : 'Set up payouts'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/*
                          Contact email and address used to render here from the
                          public directory payload, which carries neither — two
                          permanently blank fields under real-looking labels.
                        */}
                        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800 mt-1">
                            <button
                                onClick={() => handleViewStudents(school.id)}
                                className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-all"
                            >
                                View Students
                            </button>
                        </div>
                    </div>
                  );
                })
            )}
        </div>
      </div>
    </Layout>
  );
};

export default SchoolListScreen;
