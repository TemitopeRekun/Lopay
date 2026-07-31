import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUIStore } from "../store/uiStore";
import {
  useUser,
  useUpdateSchool,
  useSchoolBankDetails,
} from "../hooks/useQueries";
import { ImpersonationBanner } from "../components/profile/ImpersonationBanner";
import { ProfileIdentityHeader } from "../components/profile/ProfileIdentityHeader";
import { ContactDetailsSection } from "../components/profile/ContactDetailsSection";
import { InstitutionalLinkCard } from "../components/profile/InstitutionalLinkCard";
import { SettlementAccountSection } from "../components/profile/SettlementAccountSection";
import { AccountAccessMenu } from "../components/profile/AccountAccessMenu";
import { ProfileFooter } from "../components/profile/ProfileFooter";
import { normalizePhone, validatePhone } from "../utils/phone";

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
    effectiveRole,
    activeSchoolId,
  } = useAuth();
  const { schools } = useData();
  const { showToast } = useUIStore();
  const navigate = useNavigate();

  // Fetch acting user data if impersonating
  const { data: actingUser } = useUser(actingUserId);
  const updateSchool = useUpdateSchool();

  // Determine effective user
  const effectiveUser = actingUserId ? actingUser : user;

  const isImpersonating = !!actingUserId;
  const isSchoolOwner = effectiveRole === "school_owner";
  const schoolId = effectiveUser?.schoolId || activeSchoolId || null;

  // Edit state for bank details
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editBankData, setEditBankData] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
  });

  // Edit state for the contact phone number
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const userSchool = useMemo(() => {
    if (schoolId) {
      return schools.find((s) => s.id === schoolId) || null;
    }

    if (isSchoolOwner && effectiveUser?.email) {
      const email = effectiveUser.email.trim().toLowerCase();
      return (
        schools.find((s) => (s.email || "").trim().toLowerCase() === email) ||
        null
      );
    }

    return null;
  }, [schoolId, schools, isSchoolOwner, effectiveUser?.email]);

  const schoolIdForBankDetails = userSchool?.id || schoolId || null;

  const { data: schoolBankDetails } = useSchoolBankDetails(
    schoolIdForBankDetails,
    isSchoolOwner && !!schoolIdForBankDetails,
  );

  const schoolBank = isSchoolOwner
    ? {
        bankName: schoolBankDetails?.bankName ?? userSchool?.bankName,
        accountName: schoolBankDetails?.accountName ?? userSchool?.accountName,
        accountNumber:
          schoolBankDetails?.accountNumber ?? userSchool?.accountNumber,
      }
    : null;

  const displayName = useMemo(() => {
    const name = effectiveUser?.name;
    const hasUserName = !!name && name !== "Unknown User";

    if (isSchoolOwner) {
      return (
        userSchool?.name ||
        userSchool?.ownerName ||
        (hasUserName ? name : undefined) ||
        "School Owner"
      );
    }

    if (hasUserName) return name;
    return userSchool?.ownerName || userSchool?.name || "User";
  }, [
    effectiveUser?.name,
    isSchoolOwner,
    userSchool?.ownerName,
    userSchool?.name,
  ]);

  // Initialize edit state when entering edit mode
  const startEditing = () => {
    setEditBankData({
      bankName:
        isSchoolOwner && schoolBank?.bankName
          ? schoolBank.bankName
          : effectiveUser?.bankName || "",
      accountName:
        isSchoolOwner && schoolBank?.accountName
          ? schoolBank.accountName
          : effectiveUser?.accountName || "",
      accountNumber:
        isSchoolOwner && schoolBank?.accountNumber
          ? schoolBank.accountNumber
          : effectiveUser?.accountNumber || "",
    });
    setIsEditingBank(true);
  };

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

    const currentBank = isSchoolOwner ? schoolBank : effectiveUser;
    const updatedData = {
      bankName: editBankData.bankName || currentBank?.bankName || "",
      accountName: editBankData.accountName || currentBank?.accountName || "",
      accountNumber:
        editBankData.accountNumber || currentBank?.accountNumber || "",
    };

    try {
      if (isSchoolOwner && userSchool) {
        await updateSchool.mutateAsync({
          ...userSchool,
          ...updatedData,
        });
      } else {
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

  const startEditingPhone = () => {
    setPhoneInput(effectiveUser?.phoneNumber || "");
    setPhoneError(null);
    setIsEditingPhone(true);
  };

  // Validate as they type, but stay quiet until there's something to complain
  // about — an error on an empty field the moment the form opens reads as a
  // failure rather than a prompt.
  const handlePhoneInputChange = (value: string) => {
    setPhoneInput(value);
    setPhoneError(value.trim() ? validatePhone(value) : null);
  };

  const handleSavePhone = async () => {
    const validationError = validatePhone(phoneInput);
    if (validationError) {
      setPhoneError(validationError);
      return;
    }

    setIsSavingPhone(true);
    try {
      await updateAuthUser({ phoneNumber: normalizePhone(phoneInput) });
      setIsEditingPhone(false);
      showToast("Phone number updated successfully!", "success");
    } catch (error) {
      console.error("Failed to update phone number", error);
      showToast("Failed to update phone number. Please try again.", "error");
    } finally {
      setIsSavingPhone(false);
    }
  };

  const getRoleLabel = () => {
    switch (effectiveUser?.role) {
      case "owner":
        return "Platform Admin";
      case "school_owner":
        return "School Bursar";
      default:
        return "Parent Account";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Account number copied!", "success");
  };

  const handleCopyAccountNumber = () => {
    const accountNumber = isSchoolOwner
      ? schoolBank?.accountNumber
      : effectiveUser?.accountNumber;
    if (!accountNumber) return;
    copyToClipboard(accountNumber);
  };

  const currentBankName = isSchoolOwner
    ? schoolBank?.bankName
    : effectiveUser?.bankName;
  const currentAccountName = isSchoolOwner
    ? schoolBank?.accountName
    : effectiveUser?.accountName;
  const currentAccountNumber = isSchoolOwner
    ? schoolBank?.accountNumber
    : effectiveUser?.accountNumber;

  return (
    <Layout showBottomNav>
      {isImpersonating && (
        <ImpersonationBanner
          displayName={displayName}
          onExit={handleExitImpersonation}
        />
      )}

      <Header title="My Profile" />
      <div className="flex-1 overflow-y-auto pb-10">
        <ProfileIdentityHeader
          displayName={displayName}
          email={effectiveUser?.email}
          phoneNumber={effectiveUser?.phoneNumber}
          roleLabel={getRoleLabel()}
        />

        <div className="p-6 space-y-8">
          {userSchool && <InstitutionalLinkCard schoolName={userSchool.name} />}

          <ContactDetailsSection
            isEditing={isEditingPhone}
            phoneInput={phoneInput}
            currentPhoneNumber={effectiveUser?.phoneNumber}
            error={phoneError}
            canEdit={!isImpersonating}
            isSaving={isSavingPhone}
            onStartEditing={startEditingPhone}
            onCancel={() => setIsEditingPhone(false)}
            onSave={handleSavePhone}
            onPhoneInputChange={handlePhoneInputChange}
          />

          {isSchoolOwner && (
            <SettlementAccountSection
              isEditing={isEditingBank}
              editBankData={editBankData}
              currentBankName={currentBankName}
              currentAccountName={currentAccountName}
              currentAccountNumber={currentAccountNumber}
              onStartEditing={startEditing}
              onCancel={() => setIsEditingBank(false)}
              onSave={handleSaveBank}
              onEditBankDataChange={setEditBankData}
              onCopyAccountNumber={handleCopyAccountNumber}
            />
          )}

          <AccountAccessMenu
            isOwnerAccount={isOwnerAccount}
            isImpersonating={isImpersonating}
            userRole={userRole}
            onSwitch={handleSwitch}
            onSettings={() => navigate("/settings")}
            onSupport={() => navigate("/support")}
            onDirectory={() => navigate("/admin/users")}
          />

          <ProfileFooter
            isImpersonating={isImpersonating}
            onLogout={logout}
            userId={effectiveUser?.id}
            userRole={userRole}
            rawRole={effectiveUser?.role}
          />
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default ProfileScreen;
