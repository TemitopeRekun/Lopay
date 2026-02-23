import React, { useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useSchoolBankDetails } from "../hooks/useQueries";
import { BackendAPI, getPlatformActivationBankDetails } from "../services/backend";
import { NativeBridge } from "../services/native";

const PaymentMethodsScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role: userRole, user: currentUser } = useAuth();
  const { submitPayment, childrenData, schools } = useData();
  const { showToast } = useUI();
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  const state = location.state as {
    paymentType?: string;
    amount?: number;
    childId?: string;
    allowCustom?: boolean;
    isCustomOnly?: boolean;
  } | null;
  const isPaymentFlow = state?.paymentType === "installment";
  const isStudent = userRole === "university_student";

  const child = useMemo(() => {
    return childrenData.find((c) => c.id === state?.childId);
  }, [childrenData, state?.childId]);

  const [paymentAmount, setPaymentAmount] = useState(state?.amount || 0);
  const [isEditingAmount, setIsEditingAmount] = useState(!!state?.isCustomOnly);

  const isFirstPaymentFlow =
    !isPaymentFlow && (!child || (Number.isFinite(child.paidAmount) ? child.paidAmount : 0) === 0);

  const school = useMemo(() => {
    if (!child) return null;
    return (
      schools.find((s) => s.id === child.schoolId) ||
      schools.find((s) => s.name === child.school)
    );
  }, [schools, child]);

  const schoolIdForBankDetails = child?.schoolId || school?.id || null;
  const needsSchoolBankDetails = !isFirstPaymentFlow;

  const {
    data: schoolBankDetails,
    isLoading: isLoadingSchoolBankDetails,
    isError: isSchoolBankDetailsError,
  } = useSchoolBankDetails(schoolIdForBankDetails, needsSchoolBankDetails);

  const institutionBank = useMemo(() => {
    if (!school || !schoolBankDetails) return null;
    return {
      accountName: schoolBankDetails.accountName || school.name,
      bankName: schoolBankDetails.bankName,
      accountNumber: schoolBankDetails.accountNumber,
      isLopayEscrow: false,
      institutionName: school.name,
    };
  }, [school, schoolBankDetails]);

  const activeBankDetails = useMemo(() => {
    if (!isFirstPaymentFlow && institutionBank) {
      return institutionBank;
    }

    if (!isFirstPaymentFlow && !institutionBank) {
      return null;
    }

    return {
      ...getPlatformActivationBankDetails(isStudent),
    };
  }, [isFirstPaymentFlow, institutionBank, isStudent]);

  const canEditAmount =
    !!activeBankDetails && !activeBankDetails.isLopayEscrow && state?.allowCustom;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Account number copied!", "success");
  };

  const handleSelectReceipt = () => {
    receiptInputRef.current?.click();
  };

  const processReceiptDataUrl = (dataUrl: string, fileName?: string) => {
    setReceiptFileName(fileName || "receipt.jpg");
    setReceiptUrl(null);
    setReceiptPath(null);
    setUploadProgress(0);

    const img = new Image();
    img.onload = () => {
      const maxDimension = 1024;
      const scale = Math.min(
        1,
        maxDimension / Math.max(img.width, img.height),
      );
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        showToast("Failed to process receipt image.", "error");
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const preview = canvas.toDataURL("image/jpeg", 0.6);
      setReceiptImage(preview);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            showToast("Failed to compress receipt image.", "error");
            return;
          }
          setReceiptBlob(blob);
        },
        "image/jpeg",
        0.6,
      );
    };
    img.onerror = () => {
      showToast("Failed to process receipt image. Please try again.", "error");
    };
    img.src = dataUrl;
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      showToast("Please select a receipt image.", "warning");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("Receipt must be an image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        showToast("Failed to read receipt image. Please try again.", "error");
        return;
      }
      processReceiptDataUrl(reader.result, file.name);
    };
    reader.onerror = () => {
      showToast("Failed to read receipt image. Please try again.", "error");
    };
    reader.readAsDataURL(file);
  };

  const handlePickFromPhone = async () => {
    if (!NativeBridge.isNative()) {
      handleSelectReceipt();
      return;
    }

    const permission = await NativeBridge.requestCameraPermissions();
    if (permission.photos !== "granted") {
      showToast("Photo access is required to select a receipt.", "warning");
      return;
    }

    try {
      await NativeBridge.requestFilesystemPermissions();
      const photo = await NativeBridge.pickPhoto();
      if (!photo.dataUrl) {
        showToast("No photo selected. Please try again.", "error");
        return;
      }
      processReceiptDataUrl(photo.dataUrl, "receipt.jpg");
    } catch (error) {
      console.error(error);
      showToast("Failed to open photos. Please try again.", "error");
    }
  };

  const uploadReceipt = async () => {
    if (receiptPath) {
      return { path: receiptPath };
    }
    if (!receiptBlob) {
      throw new Error("Receipt image is missing.");
    }

    const safeName = (receiptFileName || "receipt.jpg")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-_.]/g, "");
    const normalizedFileName = safeName.endsWith(".jpg")
      ? safeName
      : `${safeName}.jpg`;

    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        setIsUploading(true);
        setUploadProgress(0);

        const { path, signedUrl } =
          await BackendAPI.documents.receipts.createUploadUrl({
            fileName: normalizedFileName,
            contentType: "image/jpeg",
          });

        const uploadResponse = await fetch(signedUrl, {
          method: "PUT",
          body: receiptBlob,
          headers: {
            "Content-Type": "image/jpeg",
          },
        });

        if (!uploadResponse.ok) {
          showToast("Receipt upload failed. Please try again.", "error");
          throw new Error("Receipt upload failed.");
        }

        setUploadProgress(100);
        setReceiptUrl(path);
        setReceiptPath(path);
        setIsUploading(false);
        showToast("Receipt uploaded successfully.", "success");
        return { path };
      } catch (error) {
        lastError = error;
        setIsUploading(false);
        if (attempt < maxAttempts) {
          showToast("Upload failed. Retrying...", "warning");
        }
      }
    }

    throw lastError || new Error("Failed to upload receipt.");
  };

  const cleanupUploadedReceipt = async () => {
    setReceiptPath(null);
    setReceiptUrl(null);
  };

  const handlePaymentSent = async () => {
    if (!receiptImage || !receiptBlob) {
      showToast("Please upload a payment receipt before submitting.", "error");
      return;
    }
    if (state?.childId && paymentAmount > 0) {
      setIsProcessing(true);
      try {
        const { path: uploadedPath } = await uploadReceipt();
        await submitPayment(
          state.childId!,
          paymentAmount,
          uploadedPath || undefined,
        );
        showToast(
          "Payment submitted successfully! Waiting for school confirmation.",
          "success"
        );
        navigate("/dashboard");
      } catch (error) {
        console.error(error);
        showToast("Failed to submit payment. Please try again.", "error");
        await cleanupUploadedReceipt();
      } finally {
        setIsProcessing(false);
      }
    } else {
      showToast("Please enter a valid amount.", "error");
    }
  };

  const entityType = isStudent ? "Institution" : "School";

  const primaryHeadingLabel =
    isFirstPaymentFlow && !isStudent
      ? "First payment (platform account)"
      : !isFirstPaymentFlow && !isStudent && school
        ? `Ongoing installments (${school.name} account)`
        : activeBankDetails && activeBankDetails.isLopayEscrow
          ? "Platform account"
          : "School account";

  const paymentInfoCopy =
    !isStudent && isFirstPaymentFlow
      ? "This first payment is processed by LoPay. Please pay into the LoPay platform account shown below."
      : !isStudent && !isFirstPaymentFlow
        ? "These installments are paid directly to your school. Please pay into the school's account shown below."
        : "";

  if (!activeBankDetails) {
    if (needsSchoolBankDetails && isLoadingSchoolBankDetails) {
      return (
        <Layout>
          <Header
            title={isFirstPaymentFlow ? "First Payment" : `${entityType} Installment`}
          />
          <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
            <div className="mb-4 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 text-xs text-text-secondary-light">
              Fetching this school’s latest bank details...
            </div>
          </div>
        </Layout>
      );
    }

    if (needsSchoolBankDetails && isSchoolBankDetailsError) {
      return (
        <Layout>
          <Header
            title={isFirstPaymentFlow ? "First Payment" : `${entityType} Installment`}
          />
          <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
            <div className="mb-4 px-4 py-3 rounded-2xl bg-danger/10 border border-danger/30 text-xs text-danger">
              Unable to load this school’s bank details. Please try again or contact support.
            </div>
          </div>
        </Layout>
      );
    }
  }

  return (
    <Layout>
      <Header
        title={
          isFirstPaymentFlow
            ? "First Payment"
            : `${entityType} Installment`
        }
      />
      <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
        <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 flex items-center gap-4 animate-fade-in">
          <div
            className={`size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg ${activeBankDetails.isLopayEscrow ? "bg-primary" : "bg-success"}`}
          >
            <span className="material-symbols-outlined text-2xl">
              {activeBankDetails.isLopayEscrow
                ? "verified_user"
                : "account_balance"}
            </span>
          </div>
          <div className="overflow-hidden">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-secondary-light">
              {primaryHeadingLabel}
            </p>
            <h3 className="text-sm font-bold truncate text-text-primary-light dark:text-text-primary-dark">
              {activeBankDetails.institutionName}
            </h3>
          </div>
        </div>

        {isPaymentFlow && (
          <div
            className={`mb-6 text-center rounded-[32px] p-6 border-2 transition-all shadow-xl shadow-gray-100 dark:shadow-none animate-fade-in-up ${activeBankDetails.isLopayEscrow ? "bg-primary/5 border-primary/20" : "bg-success/5 border-success/20"}`}
          >
            <div className="flex justify-center mb-2">
              <span
                className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${activeBankDetails.isLopayEscrow ? "bg-primary text-white" : "bg-success text-white"}`}
              >
                {activeBankDetails.isLopayEscrow
                  ? "Phase 1: Activation"
                  : `Phase 2: Direct Payment`}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-bold uppercase tracking-widest mb-1">
                Transfer Amount
              </p>

              {isEditingAmount && canEditAmount ? (
                <div className="relative w-full max-w-[200px] flex items-center justify-center">
                  <span className="text-2xl font-black text-success mr-1">
                    ₦
                  </span>
                  <input
                    type="number"
                    autoFocus
                    value={paymentAmount || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const remaining =
                        (child?.totalFee || 0) - (child?.paidAmount || 0);
                      setPaymentAmount(Math.min(val, remaining));
                    }}
                    className="w-full bg-transparent border-none text-center text-4xl font-black text-success p-0 outline-none"
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p
                    className={`text-4xl font-black tracking-tight ${activeBankDetails.isLopayEscrow ? "text-primary" : "text-success"}`}
                  >
                    ₦
                    {paymentAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  {canEditAmount && (
                    <button
                      onClick={() => setIsEditingAmount(true)}
                      className="size-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-text-secondary-light hover:text-success transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        edit
                      </span>
                    </button>
                  )}
                </div>
              )}

              {!activeBankDetails.isLopayEscrow && child && (
                <p className="text-[9px] font-bold text-text-secondary-light mt-1 uppercase">
                  Outstanding Balance: ₦
                  {(() => {
                    const totalFee = Number.isFinite(child.totalFee)
                      ? child.totalFee
                      : 0;
                    const paidAmount = Number.isFinite(child.paidAmount)
                      ? child.paidAmount
                      : 0;
                    return (totalFee - paidAmount).toLocaleString();
                  })()}
                </p>
              )}
            </div>
          </div>
        )}

        <div
          className={`bg-white dark:bg-card-dark border-2 rounded-[32px] p-6 shadow-sm mb-6 relative overflow-hidden transition-all animate-fade-in-up delay-75 ${activeBankDetails.isLopayEscrow ? "border-primary/20" : "border-success/20"}`}
        >
          <div className="space-y-4">
            {paymentInfoCopy && (
              <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
                {paymentInfoCopy}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
                {activeBankDetails.isLopayEscrow
                  ? "Pay to LoPay (platform) account"
                  : school
                    ? `Pay to ${school.name} account`
                    : "Pay to school account"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
                Bank Provider
              </span>
              <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">
                {activeBankDetails.bankName}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
                Account Holder
              </span>
              <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">
                {activeBankDetails.accountName}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
                Account Identifier
              </span>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-1">
                <span className="font-mono text-2xl font-black tracking-[0.2em] text-text-primary-light dark:text-text-primary-dark">
                  {activeBankDetails.accountNumber}
                </span>
                <button
                  className={`size-11 flex items-center justify-center rounded-xl text-white shadow-lg active:scale-90 transition-all ${activeBankDetails.isLopayEscrow ? "bg-primary shadow-primary/20" : "bg-success shadow-success/20"}`}
                  onClick={() =>
                    copyToClipboard(activeBankDetails.accountNumber)
                  }
                >
                  <span className="material-symbols-outlined text-xl">
                    content_copy
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest mb-2 px-1">
            Proof of Transfer
          </p>
          {isUploading && (
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Uploading receipt... {uploadProgress}%
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*"
            onChange={handleReceiptFileChange}
            className="hidden"
          />
          {receiptImage ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 h-44">
              <img
                src={receiptImage}
                alt="Receipt"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setReceiptImage(null)}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePickFromPhone}
                className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-text-secondary-light group"
              >
                <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
                  <span className="material-symbols-outlined">
                    photo_library
                  </span>
                </div>
                <span className="text-xs font-bold uppercase tracking-tight">
                  Upload File
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <button
            onClick={handlePaymentSent}
            disabled={isProcessing || paymentAmount <= 0}
            className={`w-full h-16 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 ${activeBankDetails.isLopayEscrow ? "bg-primary shadow-primary/20" : "bg-success shadow-success/20"}`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <span className="size-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Processing...</span>
              </div>
            ) : (
              "I have made this transfer"
            )}
          </button>
          <p className="text-center text-[10px] text-text-secondary-light mt-4 font-bold uppercase tracking-tight">
            256-bit Secure Transaction
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentMethodsScreen;
