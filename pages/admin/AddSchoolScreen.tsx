import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { Header } from "../../components/Header";
import { useAddSchool } from "../../hooks/useQueries";
import { useUI } from "../../context/UIContext";
import { BackendAPI } from "../../services/backend";

const AddSchoolScreen: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: addSchool, isPending: isSubmitting } = useAddSchool();
  const { showToast } = useUI();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Paystack bank list for the settlement-bank dropdown.
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);

  useEffect(() => {
    BackendAPI.admin
      .getBanks()
      .then((list) => setBanks(list))
      .catch(() => showToast("Could not load bank list. Try again.", "error"));
  }, [showToast]);

  const bankName = useMemo(
    () => banks.find((b) => b.code === bankCode)?.name ?? "",
    [banks, bankCode],
  );

  // Reset verification whenever the account number or bank changes.
  useEffect(() => {
    setAccountVerified(false);
  }, [accountNumber, bankCode]);

  const handleVerifyAccount = async () => {
    if (!bankCode || accountNumber.length < 10) {
      showToast("Select a bank and enter a 10-digit account number.", "warning");
      return;
    }
    setIsVerifying(true);
    try {
      const result = await BackendAPI.admin.resolveAccount(accountNumber, bankCode);
      setAccountName(result.accountName);
      setAccountVerified(true);
      showToast(`Account verified: ${result.accountName}`, "success");
    } catch (error: any) {
      setAccountVerified(false);
      showToast(
        error.response?.data?.message || "Could not verify account. Check the details.",
        "error",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !ownerName || !bankCode || !accountNumber)
      return;
    if (!accountVerified) {
      showToast("Please verify the bank account before onboarding.", "warning");
      return;
    }

    addSchool(
      {
        schoolName: name,
        ownerEmail: email,
        ownerPassword: password,
        ownerName: ownerName,
        address: address,
        phone: phone,
        bankName: bankName,
        bankCode: bankCode,
        accountName: accountName,
        accountNumber: accountNumber,
      },
      {
        onSuccess: () => {
          showToast("School onboarded successfully!", "success");
          navigate("/owner-dashboard");
        },
        onError: (error: any) => {
          console.error("Failed to onboard school", error);
          showToast(
            error.response?.data?.message || "Failed to onboard school",
            "error"
          );
        },
      }
    );
  };

  return (
    <Layout>
      <Header title="Add New School" />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              School Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Lagos International School"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. 15 Victoria Island"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Owner Name
            </label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Dr. John Doe"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Owner Email (Login Email)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="admin@school.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Owner Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="Set a secure password"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Phone Number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="08012345678"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Settlement Bank
            </label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              required
              disabled={isSubmitting || banks.length === 0}
            >
              <option value="">
                {banks.length === 0 ? "Loading banks…" : "Select a bank"}
              </option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-text-secondary-light">
              Funds collected via Paystack settle to this account.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Account Number
            </label>
            <div className="flex gap-2">
              <input
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                inputMode="numeric"
                className="input-field flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
                placeholder="0123456789"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleVerifyAccount}
                disabled={isVerifying || !bankCode || accountNumber.length < 10}
                className="px-4 rounded-xl bg-secondary text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                {isVerifying ? "…" : accountVerified ? "✓" : "Verify"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary-light">
              Account Name
            </label>
            <input
              value={accountName}
              readOnly
              className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-4 outline-none text-text-secondary-light"
              placeholder="Verify the account to auto-fill the name"
            />
            {accountVerified && (
              <p className="text-[10px] font-bold text-success uppercase tracking-widest">
                ✓ Account verified
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-auto w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Saving...</span>
            </div>
          ) : (
            "Onboard School"
          )}
        </button>
      </form>
    </Layout>
  );
};

export default AddSchoolScreen;
