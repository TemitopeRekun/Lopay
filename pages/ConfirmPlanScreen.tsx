import React, { useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { PaymentPlan } from "../types";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { BackendAPI, PLATFORM_BANK } from "../services/backend";
import { NativeBridge } from "../services/native";

interface LocationState {
  childName?: string;
  schoolName?: string;
  grade?: string;
  totalFee?: number;
  plan?: PaymentPlan;
  depositAmount?: number;
  feeType?: "Semester" | "Session";
  schoolId?: string;
  totalInitialPayment?: number;
  platformFeeAmount?: number;
}

const ConfirmPlanScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addChild } = useData();
  const { role: userRole } = useAuth();
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

  const state = location.state as LocationState;

  if (!state) return null;

  const {
    childName = "Student",
    schoolName = "Unknown School",
    grade = "Unknown",
    totalFee = 0,
    plan,
    depositAmount = 0,
    feeType = "Session",
    schoolId,
  } = state;
  const isStudent = userRole === "university_student";
  const entityType = isStudent ? "Institution" : "School";

  const platformFee = state.platformFeeAmount ?? 0;
  const initialActivationPayment =
    state.totalInitialPayment || depositAmount + platformFee;

  // Standard installment amount for later (remaining 75% / plan length)
  const effectivePlan =
    plan || {
      type: "Monthly",
      amount: totalFee,
      frequencyLabel: "Monthly",
      numberOfPayments: 3,
    };

  const futureInstallmentAmount =
    effectivePlan.numberOfPayments > 0
      ? (totalFee * 0.75) / effectivePlan.numberOfPayments
      : 0;

  const monthsDuration = feeType === "Session" ? 7 : 3;

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

  const handleConfirm = async () => {
    if (!receiptImage || !receiptBlob) {
      showToast("Please upload a payment receipt to proceed.", "error");
      return;
    }
    if (!schoolId) {
      showToast("Missing school information. Please restart the process.", "error");
      return;
    }

    setIsProcessing(true);

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (effectivePlan.type === "Weekly") {
      endDate.setDate(startDate.getDate() + effectivePlan.numberOfPayments * 7);
    } else {
      endDate.setMonth(startDate.getMonth() + effectivePlan.numberOfPayments);
    }

    try {
      const { path: uploadedPath } = await uploadReceipt();

      setTimeout(async () => {
        try {
          await addChild(
            {
              childName,
              schoolId,
              className: grade,
            installmentFrequency: effectivePlan.type,
              firstPaymentPaid: initialActivationPayment,
              termStartDate: startDate.toISOString(),
              termEndDate: endDate.toISOString(),
            },
            uploadedPath || receiptUrl || undefined,
          );

          navigate("/dashboard");
        } catch (err: any) {
          console.error(
            "Confirmation failed detailed:",
            err.response?.data || err.message,
          );
          const backendMessage = err.response?.data?.message;
          // Handle array of error messages (e.g. class-validator)
          const errorMessage = Array.isArray(backendMessage)
            ? backendMessage.join(", ")
            : backendMessage || err.message || "Failed to confirm enrollment.";

          showToast(`Enrollment Failed: ${errorMessage}`, "error");
          setIsProcessing(false);
          await cleanupUploadedReceipt();
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      showToast("Failed to upload receipt. Please try again.", "error");
      setIsProcessing(false);
      await cleanupUploadedReceipt();
    }
  };

  return (
    <Layout>
      <Header title="Finalize & Activate" />

      <div className="flex-1 p-6 overflow-y-auto pb-40">
        {/* Header Summary */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full overflow-hidden shadow-inner shrink-0">
            <img
              src={`https://ui-avatars.com/api/?name=${childName.replace(" ", "+")}&background=random`}
              alt="user"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-lg font-bold leading-tight truncate">
              {childName}
            </h3>
            <p className="text-[10px] font-bold uppercase text-text-secondary-light truncate">
              {grade} • {schoolName}
            </p>
          </div>
        </div>

        <section className="mb-8">
          <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider mb-4 px-1">
            Activation Details
          </h3>
          <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl relative overflow-hidden mb-4 border border-white/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-sm filled">
                  verified
                </span>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  First payment (platform account)
                </p>
              </div>
              <h2 className="text-4xl font-black tracking-tighter mb-4">
                ₦
                {initialActivationPayment.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </h2>

              {/* Bank Details Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Bank Name
                  </span>
                  <span className="text-xs font-bold">
                    {PLATFORM_BANK.bankName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Account Name
                  </span>
                  <span className="text-xs font-bold">
                    {PLATFORM_BANK.accountName}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Account Number
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-black tracking-widest">
                      {PLATFORM_BANK.accountNumber}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(PLATFORM_BANK.accountNumber)
                      }
                      className="bg-primary text-white p-1.5 rounded-lg active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-sm">
                        content_copy
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[9px] text-slate-400 leading-relaxed font-medium italic text-center">
                This first payment is processed by LoPay. Please pay into the LoPay
                platform account shown above.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4 px-1">
            Proof of Transfer
          </h3>
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
            <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 h-32">
              <img
                src={receiptImage}
                alt="Receipt"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  setReceiptImage(null);
                  setReceiptBlob(null);
                  setReceiptFileName(null);
                  setReceiptUrl(null);
                  setReceiptPath(null);
                  setUploadProgress(0);
                }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handlePickFromPhone}
              className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-text-secondary-light group"
            >
              <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
                <span className="material-symbols-outlined">photo_library</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-tight">
                Upload Payment Receipt
              </span>
            </button>
          )}
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4 px-1">
            Future Roadmap
          </h3>
          <div className="bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">
                schedule
              </span>
              {entityType} Installment Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-text-secondary-light">
                  Installment Amount
                </span>
                <span className="font-bold">
                  ₦
                  {futureInstallmentAmount.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {effectivePlan.frequencyLabel}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary-light">
                  Plan Duration
                </span>
                <span className="font-bold">{monthsDuration} Months</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl flex items-start gap-2 border border-primary/10">
              <span className="material-symbols-outlined text-sm text-primary">
                info
              </span>
              <p className="text-[10px] font-bold text-primary-dark dark:text-primary leading-snug uppercase tracking-tight">
                After activation, all remaining payments are made directly to
                the {entityType.toLowerCase()}'s verified bank details.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800 z-20 pb-safe">
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Activating...</span>
            </div>
          ) : (
            "I have made this transfer"
          )}
        </button>
        <p className="text-center text-[10px] text-text-secondary-light mt-3 font-medium uppercase tracking-tight">
          By confirming, you agree to the{" "}
          <Link to="/terms" className="font-medium text-primary underline">
            Escrow Terms
          </Link>
          .
        </p>
      </div>
    </Layout>
  );
};

export default ConfirmPlanScreen;
