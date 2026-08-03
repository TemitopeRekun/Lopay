import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUIStore } from "../store/uiStore";
import { useUpdateSchool, useSchoolBankDetails } from "../hooks/useQueries";
import { ProfileIdentityHeader } from "../components/profile/ProfileIdentityHeader";
import { ContactDetailsSection } from "../components/profile/ContactDetailsSection";
import { InstitutionalLinkCard } from "../components/profile/InstitutionalLinkCard";
import { SettlementAccountSection } from "../components/profile/SettlementAccountSection";
import { AccountAccessMenu } from "../components/profile/AccountAccessMenu";
import { LinkedAccountsSection } from "../components/profile/LinkedAccountsSection";
import { ProfileFooter } from "../components/profile/ProfileFooter";
import { normalizePhone, validatePhone } from "../utils/phone";
import { useGoogleLink } from "../hooks/useGoogleLink";

const ProfileScreen: React.FC = () => {
  const {
    logout,
    role: userRole,
    user,
    updateUser: updateAuthUser,
    isOwnerAccount,
  } = useAuth();
  const { schools } = useData();
  const { showToast } = useUIStore();
  const navigate = useNavigate();

  const updateSchool = useUpdateSchool();

  // Which sign-in methods this account has, plus the "connect Google" action.
  // Linking has to happen from a signed-in session: Better Auth refuses to attach
  // Google to an unverified email/password account at sign-in time, and this app
  // sends no verification email. See hooks/useGoogleLink.ts.
  const googleLink = useGoogleLink();

  // Always the signed-in user. This screen used to render another user's
  // profile while an admin "impersonated" them; that entry point is gone, so
  // everything here is self-service and every write targets the real session.
  const isSchoolOwner = userRole === "school_owner";
  const schoolId = user?.schoolId || null;

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

    if (isSchoolOwner && user?.email) {
      const email = user.email.trim().toLowerCase();
      return (
        schools.find((s) => (s.email || "").trim().toLowerCase() === email) ||
        null
      );
    }

    return null;
  }, [schoolId, schools, isSchoolOwner, user?.email]);

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
    const name = user?.name;
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
    user?.name,
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
          : user?.bankName || "",
      accountName:
        isSchoolOwner && schoolBank?.accountName
          ? schoolBank.accountName
          : user?.accountName || "",
      accountNumber:
        isSchoolOwner && schoolBank?.accountNumber
          ? schoolBank.accountNumber
          : user?.accountNumber || "",
    });
    setIsEditingBank(true);
  };

  const handleSaveBank = async () => {
    if (!user) return;

    const currentBank = isSchoolOwner ? schoolBank : user;
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
          ...user,
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
    setPhoneInput(user?.phoneNumber || "");
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
    switch (user?.role) {
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
      : user?.accountNumber;
    if (!accountNumber) return;
    copyToClipboard(accountNumber);
  };

  const currentBankName = isSchoolOwner
    ? schoolBank?.bankName
    : user?.bankName;
  const currentAccountName = isSchoolOwner
    ? schoolBank?.accountName
    : user?.accountName;
  const currentAccountNumber = isSchoolOwner
    ? schoolBank?.accountNumber
    : user?.accountNumber;

  return (
    <Layout showBottomNav>
      <Header title="My Profile" />
      <div className="flex-1 overflow-y-auto pb-10">
        <ProfileIdentityHeader
          displayName={displayName}
          email={user?.email}
          phoneNumber={user?.phoneNumber}
          roleLabel={getRoleLabel()}
        />

        <div className="p-6 space-y-8">
          {userSchool && <InstitutionalLinkCard schoolName={userSchool.name} />}

          <ContactDetailsSection
            isEditing={isEditingPhone}
            phoneInput={phoneInput}
            currentPhoneNumber={user?.phoneNumber}
            error={phoneError}
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

          <LinkedAccountsSection
            isGoogleLinked={googleLink.isGoogleLinked}
            isPasswordEnabled={googleLink.isPasswordEnabled}
            isLoading={googleLink.isLoading}
            onConnectGoogle={() => void googleLink.connect()}
            isConnecting={googleLink.isConnecting}
            error={googleLink.error}
          />

          <AccountAccessMenu
            isOwnerAccount={isOwnerAccount}
            onSettings={() => navigate("/settings")}
            onSupport={() => navigate("/support")}
            onDirectory={() => navigate("/admin/users")}
          />

          <ProfileFooter
            onLogout={logout}
            userId={user?.id}
            userRole={userRole}
            rawRole={user?.role}
          />
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default ProfileScreen;
