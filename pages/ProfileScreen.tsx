import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useUser, useUpdateUser } from "../hooks/useQueries";

const ProfileScreen: React.FC = () => {
  const {
    logout,
    role: userRole,
    user,
    switchRole,
    actingUserId,
    setActingRole,
    updateUser: updateAuthUser,
    isOwnerAccount,
  } = useAuth();
  const { schools } = useData();
  const { showToast } = useUI();
  const navigate = useNavigate();

  // Fetch acting user data if impersonating
  const { data: actingUser } = useUser(actingUserId);
  const updateUser = useUpdateUser();

  // Determine effective user
  const effectiveUser = actingUserId ? actingUser : user;

  const isImpersonating = !!actingUserId;
  const isSchoolOwner = userRole === "school_owner";

  // Edit state for bank details
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editBankData, setEditBankData] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
  });

  // Initialize edit state when entering edit mode
  const startEditing = () => {
    setEditBankData({
      bankName: effectiveUser?.bankName || "",
      accountName: effectiveUser?.accountName || "",
      accountNumber: effectiveUser?.accountNumber || "",
    });
    setIsEditingBank(true);
  };

  const userSchool = useMemo(() => {
    if (!effectiveUser?.schoolId) return null;
    return schools.find((s) => s.id === effectiveUser.schoolId);
  }, [effectiveUser, schools]);

  const handleSwitch = () => {
    if (switchRole) switchRole();
    if (userRole === "owner") {
      navigate("/dashboard");
    } else {
      navigate("/owner-dashboard");
    }
  };

  const handleExitImpersonation = () => {
    setActingRole("owner");
    navigate("/owner-dashboard");
  };

  const handleSaveBank = async () => {
    if (!effectiveUser) return;

    const updatedData = {
      ...editBankData,
    };

    try {
      if (isImpersonating && actingUserId) {
        // Use admin mutation to update other user
        await updateUser.mutateAsync({
          ...effectiveUser,
          ...updatedData,
          id: actingUserId,
        });
      } else {
        // Update self via AuthContext
        await updateAuthUser({
          ...effectiveUser,
          ...updatedData,
        });
      }
      setIsEditingBank(false);
      showToast("Settlement details updated successfully!", "success");
    } catch (error) {
      console.error("Failed to update bank details", error);
      showToast("Failed to update details. Please try again.", "error");
    }
  };

  const getRoleLabel = () => {
    switch (effectiveUser?.role) {
      case "owner":
        return "Platform Admin";
      case "school_owner":
        return "School Bursar";
      case "university_student":
        return "University Student";
      default:
        return "Parent Account";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Account number copied!", "success");
  };

  return (
    <Layout showBottomNav>
      {isImpersonating && (
        <div className="bg-purple-600 text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest">
              Viewing {effectiveUser?.name || "User"}'s Profile
            </p>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="bg-white text-purple-600 px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
          >
            Exit
          </button>
        </div>
      )}

      <Header title="My Profile" />
      <div className="flex-1 overflow-y-auto pb-10">
        {/* Personal Identity Header */}
        <div className="p-8 flex flex-col items-center bg-linear-to-b from-gray-50 to-white dark:from-white/5 dark:to-background-dark border-b border-gray-100 dark:border-gray-800">
          <div className="relative mb-4">
            <div className="size-24 rounded-[32px] overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl rotate-3">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(effectiveUser?.name || "User")}&background=4A90E2&color=fff&size=256&bold=true`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 size-8 bg-accent rounded-xl flex items-center justify-center text-white border-2 border-white dark:border-background-dark shadow-lg">
              <span className="material-symbols-outlined text-sm filled">
                verified
              </span>
            </div>
          </div>

          <h2 className="text-xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight text-center">
            {effectiveUser?.name}
          </h2>
          <div className="flex flex-col items-center gap-1 mt-1 mb-4">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
              {effectiveUser?.email}
            </p>
            {effectiveUser?.phoneNumber && (
              <p className="text-xs text-text-secondary-light font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  call
                </span>
                {effectiveUser.phoneNumber}
              </p>
            )}
          </div>

          <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
            {getRoleLabel()}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Contextual Information */}
          {userSchool && (
            <section className="animate-fade-in">
              <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-3 px-1">
                Institutional Link
              </h3>
              <div className="p-5 bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined filled">
                    school
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-text-primary-light dark:text-text-primary-dark leading-tight">
                    {userSchool.name}
                  </p>
                  <p className="text-[10px] text-text-secondary-light font-bold uppercase mt-1">
                    Verified Member
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Direct Settlement Account (School Owners Only) */}
          {isSchoolOwner && (
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
                  Bursary Settlement Account
                </h3>
                {!isEditingBank && (
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                    Update
                  </button>
                )}
              </div>

              {isEditingBank ? (
                <div className="p-6 bg-white dark:bg-card-dark rounded-[32px] border-2 border-primary/30 shadow-xl space-y-4 animate-scale-in">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-text-secondary-light uppercase tracking-widest mb-1 block">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={editBankData.bankName}
                        onChange={(e) =>
                          setEditBankData({
                            ...editBankData,
                            bankName: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold"
                        placeholder="e.g. Access Bank"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-text-secondary-light uppercase tracking-widest mb-1 block">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={editBankData.accountName}
                        onChange={(e) =>
                          setEditBankData({
                            ...editBankData,
                            accountName: e.target.value,
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold"
                        placeholder="Full legal account name"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-text-secondary-light uppercase tracking-widest mb-1 block">
                        Account Number
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={editBankData.accountNumber}
                        onChange={(e) =>
                          setEditBankData({
                            ...editBankData,
                            accountNumber: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold tracking-widest"
                        placeholder="10 digit account number"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsEditingBank(false)}
                      className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/10 text-text-secondary-light text-xs font-black uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBank}
                      className="flex-1 h-12 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-white/10 shadow-xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">
                        Bank Name
                      </span>
                      <span className="text-sm font-bold">
                        {effectiveUser?.bankName || "Not Set"}
                      </span>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">
                        Account Type
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                        Direct Installments
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                      Account Name
                    </span>
                    <span className="text-sm font-bold truncate">
                      {effectiveUser?.accountName || "Not Set"}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">
                        Account Number
                      </span>
                      <span className="text-2xl font-mono font-black tracking-widest text-primary">
                        {effectiveUser?.accountNumber || "0000000000"}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(effectiveUser?.accountNumber || "")
                      }
                      className="size-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        content_copy
                      </span>
                    </button>
                  </div>
                  <p className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-widest leading-relaxed">
                    This account is visible to parents for all direct
                    installment payments.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Menu Sections */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-1 px-1">
              Account & Access
            </h3>

            {isOwnerAccount && !isImpersonating && (
              <button
                onClick={handleSwitch}
                className="w-full p-4 bg-primary/5 border border-primary/20 text-primary rounded-2xl flex items-center justify-between shadow-sm hover:bg-primary/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl transition-transform group-hover:rotate-180 duration-500">
                    swap_horiz
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider">
                    {userRole === "owner"
                      ? "Switch to Parent View"
                      : "Switch to Admin Hub"}
                  </span>
                </div>
                <span className="material-symbols-outlined text-sm">
                  arrow_forward_ios
                </span>
              </button>
            )}

            <div className="bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
              <button
                onClick={() => navigate("/settings")}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary-light text-xl">
                    settings
                  </span>
                  <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                    App Settings
                  </span>
                </div>
                <span className="material-symbols-outlined text-text-secondary-light text-sm">
                  chevron_right
                </span>
              </button>

              <button
                onClick={() => navigate("/support")}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary-light text-xl">
                    help_center
                  </span>
                  <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                    Support & FAQ
                  </span>
                </div>
                <span className="material-symbols-outlined text-text-secondary-light text-sm">
                  chevron_right
                </span>
              </button>

              {isOwnerAccount && !isImpersonating && (
                <button
                  onClick={() => navigate("/admin/users")}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-secondary-light text-xl">
                      group
                    </span>
                    <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                      Directory Management
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-text-secondary-light text-sm">
                    chevron_right
                  </span>
                </button>
              )}
            </div>
          </section>

          {!isImpersonating && (
            <button
              onClick={logout}
              className="w-full h-14 bg-danger/5 text-danger border border-danger/10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:bg-danger/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Secure Log Out
            </button>
          )}

          <div className="text-center mt-4 opacity-30 hover:opacity-100 transition-opacity cursor-default">
            <p className="text-[9px] font-mono text-text-secondary-light select-all">
              User ID: {effectiveUser?.id}
              <br />
              System Role: {userRole} (Raw: {effectiveUser?.role})<br />
              v1.0.2
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default ProfileScreen;
