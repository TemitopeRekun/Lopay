import React, { useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useData } from "../context/DataContext";
import { useUIStore } from "../store/uiStore";
import { useSchoolBankDetails } from "../hooks/useQueries";
import { BackendAPI } from "../services/backend";
import { NativeBridge } from "../services/native";
import { newIdempotencyKey } from "../utils/idempotency";
import { PaymentInstitutionHeader } from "../components/payment-methods/PaymentInstitutionHeader";
import { TransferAmountCard } from "../components/payment-methods/TransferAmountCard";
import { BankDetailsCard } from "../components/payment-methods/BankDetailsCard";
import { ReceiptUploader } from "../components/payment-methods/ReceiptUploader";
import { SubmitTransferButton } from "../components/payment-methods/SubmitTransferButton";

const PaymentMethodsScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { submitPayment, childrenData, schools } = useData();
  const { showToast } = useUIStore();
  // One stable key per installment intent so retries/double-taps don't create
  // duplicate payments on the backend.
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  // Bank apps commonly export a PDF receipt, and the backend has always
  // accepted them; only this screen refused. PDFs skip the canvas compression
  // path (there is nothing to rasterise) and so carry no image preview.
  const [receiptContentType, setReceiptContentType] = useState("image/jpeg");
  const [, setReceiptUrl] = useState<string | null>(null);
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

  const child = useMemo(() => {
    return childrenData.find((c) => c.id === state?.childId);
  }, [childrenData, state?.childId]);

  const [paymentAmount, setPaymentAmount] = useState(state?.amount || 0);
  const [isEditingAmount, setIsEditingAmount] = useState(!!state?.isCustomOnly);

  const school = useMemo(() => {
    if (!child) return null;
    return (
      schools.find((s) => s.id === child.schoolId) ||
      schools.find((s) => s.name === child.school)
    );
  }, [schools, child]);

  const schoolIdForBankDetails = child?.schoolId || school?.id || null;

  // The enrollment is the source of truth for WHICH school this payment belongs
  // to; the public directory is only a nicety for the display name. Deriving the
  // name from the child means a school missing from that list (soft-deleted, or a
  // directory request that failed) no longer makes a live enrollment look unpayable.
  const schoolName = school?.name || child?.school || "your school";

  const {
    data: schoolBankDetails,
    isLoading: isLoadingSchoolBankDetails,
    isError: isSchoolBankDetailsError,
  } = useSchoolBankDetails(schoolIdForBankDetails, true);

  // Installments are paid directly into the school's own account — this screen
  // never handles first payments. Those go through the Paystack split on
  // /confirm-plan; the manual "transfer to the platform account and upload a
  // receipt" first-payment flow this screen used to render was removed from the
  // backend (there is no offline bypass), so it could show bank details for a
  // payment nothing would ever record.
  const activeBankDetails = useMemo(() => {
    if (!schoolBankDetails) return null;
    return {
      accountName: schoolBankDetails.accountName || schoolName,
      bankName: schoolBankDetails.bankName,
      accountNumber: schoolBankDetails.accountNumber,
      institutionName: schoolName,
    };
  }, [schoolName, schoolBankDetails]);

  const canEditAmount = !!activeBankDetails && !!state?.allowCustom;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Account number copied!", "success");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    const available = child?.availableBalance ?? ((child?.totalFee || 0) - (child?.paidAmount || 0));
    setPaymentAmount(Math.min(val, available));
  };

  const handleSelectReceipt = () => {
    receiptInputRef.current?.click();
  };

  const processReceiptDataUrl = (dataUrl: string, fileName?: string) => {
    setReceiptFileName(fileName || "receipt.jpg");
    setReceiptContentType("image/jpeg");
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
      showToast("Please select a receipt.", "warning");
      return;
    }

    // A PDF is uploaded as-is: there is no image to downscale, and rasterising
    // it in the browser would need a PDF renderer we don't ship.
    if (file.type === "application/pdf") {
      setReceiptFileName(file.name || "receipt.pdf");
      setReceiptContentType("application/pdf");
      setReceiptImage(null);
      setReceiptBlob(file);
      setReceiptUrl(null);
      setReceiptPath(null);
      setUploadProgress(0);
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Receipt must be an image or a PDF.", "error");
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

    const extension = receiptContentType === "application/pdf" ? ".pdf" : ".jpg";
    const safeName = (receiptFileName || `receipt${extension}`)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-_.]/g, "");
    const normalizedFileName = safeName.endsWith(extension)
      ? safeName
      : `${safeName}${extension}`;

    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        setIsUploading(true);
        setUploadProgress(0);

        const { path, signedUrl, requiredHeaders, maxUploadBytes } =
          await BackendAPI.documents.receipts.createUploadUrl({
            fileName: normalizedFileName,
            contentType: receiptContentType,
          });

        // Checked here rather than after a failed PUT: storage rejects an
        // oversized object with the same opaque failure as everything else, so
        // without this the parent is told "try again" for a file that can never
        // succeed no matter how many times they retry.
        if (maxUploadBytes && receiptBlob.size > maxUploadBytes) {
          throw new Error(
            `Receipt is ${(receiptBlob.size / 1_048_576).toFixed(1)}MB — the limit is ${(
              maxUploadBytes / 1_048_576
            ).toFixed(0)}MB. Please upload a smaller image.`,
          );
        }

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(signedUrl, {
            method: "PUT",
            body: receiptBlob,
            headers: {
              "Content-Type": receiptContentType,
              // Headers the backend bound into the signed URL (e.g. a max
              // content-length range) must be echoed verbatim or storage
              // rejects the PUT.
              ...(requiredHeaders ?? {}),
            },
          });
        } catch (networkError) {
          // `fetch` rejects with an indistinguishable TypeError whether the
          // browser blocked the request (CSP `connect-src` missing the storage
          // origin — the exact bug that made every production upload fail while
          // dev worked) or the network genuinely dropped. Name both, and log the
          // origin so the console says which one it is.
          const storageOrigin = (() => {
            try {
              return new URL(signedUrl).origin;
            } catch {
              return signedUrl;
            }
          })();
          console.error(
            `Receipt upload to ${storageOrigin} could not be sent. If the console ` +
              `also shows a Content-Security-Policy violation, that origin is ` +
              `missing from connect-src (see build/csp.ts + VITE_SUPABASE_URL).`,
            networkError,
          );
          throw new Error(
            "Couldn't reach receipt storage. Check your connection and try again.",
          );
        }

        if (!uploadResponse.ok) {
          const detail = await uploadResponse.text().catch(() => "");
          console.error(
            `Receipt upload rejected: ${uploadResponse.status} ${uploadResponse.statusText}`,
            detail,
          );
          throw new Error(
            uploadResponse.status === 413
              ? "That receipt is too large. Please upload a smaller image."
              : `Receipt storage rejected the upload (${uploadResponse.status}). Please try again.`,
          );
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

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to upload receipt.");
  };

  const cleanupUploadedReceipt = async () => {
    setReceiptPath(null);
    setReceiptUrl(null);
  };

  /**
   * Discard the chosen receipt entirely.
   *
   * This used to clear only the preview (`setReceiptImage(null)`), leaving
   * `receiptBlob` and — worse — an already-uploaded `receiptPath` in state. The
   * screen then showed the empty picker while still holding the previous file,
   * so a parent who removed the wrong receipt and submitted attached the very
   * receipt they had just taken off, against a payment it did not evidence.
   * Clearing the input's own value matters too: re-picking the same filename
   * fires no change event otherwise.
   */
  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setReceiptBlob(null);
    setReceiptFileName(null);
    setReceiptContentType("image/jpeg");
    setReceiptPath(null);
    setReceiptUrl(null);
    setUploadProgress(0);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const handlePaymentSent = async () => {
    // Gated on the blob, not the preview: a PDF receipt is a valid upload and
    // has no `receiptImage` thumbnail to show.
    if (!receiptBlob) {
      showToast("Please upload a payment receipt before submitting.", "error");
      return;
    }
    if (state?.childId && paymentAmount > 0) {
      setIsProcessing(true);
      try {
        const { path: uploadedPath } = await uploadReceipt();
        const submitted = await submitPayment(
          state.childId!,
          paymentAmount,
          uploadedPath || undefined,
          idempotencyKey,
        );
        /*
         * Same result screen as a card payment. An installment lands in
         * `processing` — it is a bank transfer awaiting the school's
         * confirmation, not money that has already moved — and the screen
         * subscribes to realtime, so the school approving it flips this to
         * confirmed while the parent is still looking at it.
         *
         * `replace: true` keeps the back button off a submitted form, whose
         * idempotency key would only replay the payment just made.
         */
        navigate("/payment-status", {
          replace: true,
          state: {
            paymentId: submitted?.id,
            fallbackAmount: paymentAmount,
            fallbackChildName: child?.name,
          },
        });
      } catch (error) {
        console.error(error);
        // Surface why it actually failed. The generic "try again" hid an
        // upload that could never succeed (blocked origin, oversized file)
        // behind advice to repeat it.
        showToast(
          error instanceof Error && error.message
            ? error.message
            : "Failed to submit payment. Please try again.",
          "error",
        );
        await cleanupUploadedReceipt();
      } finally {
        setIsProcessing(false);
      }
    } else {
      showToast("Please enter a valid amount.", "error");
    }
  };

  const entityType = "School";

  const primaryHeadingLabel = `Ongoing installments (${schoolName} account)`;

  const paymentInfoCopy =
    "These installments are paid directly to your school. Please pay into the school's account shown below.";

  if (!activeBankDetails) {
    // Arrived without an enrollment to pay against (e.g. a direct URL). There is
    // nothing payable here — say so instead of rendering a form that cannot submit.
    if (!isPaymentFlow || !state?.childId) {
      return (
        <Layout>
          <Header title={`${entityType} Installment`} />
          <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
            <div className="mb-4 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 text-xs text-text-secondary-light">
              Choose a plan from your dashboard to make a payment.
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="self-start text-primary font-bold text-xs uppercase tracking-widest"
            >
              Go to dashboard
            </button>
          </div>
        </Layout>
      );
    }

    if (isLoadingSchoolBankDetails) {
      return (
        <Layout>
          <Header title={`${entityType} Installment`} />
          <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
            <div className="mb-4 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 text-xs text-text-secondary-light">
              Fetching this school’s latest bank details...
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <Header title={`${entityType} Installment`} />
        <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
          <div className="mb-4 px-4 py-3 rounded-2xl bg-danger/10 border border-danger/30 text-xs text-danger">
            {isSchoolBankDetailsError
              ? "Unable to load this school’s bank details. Please try again or contact support."
              : "This school has not published its bank details yet. Please contact the school."}
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="self-start text-primary font-bold text-xs uppercase tracking-widest"
          >
            Go to dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title={`${entityType} Installment`} />
      <div className="p-6 flex flex-col flex-1 overflow-y-auto pb-safe">
        <PaymentInstitutionHeader
          bankDetails={activeBankDetails}
          primaryHeadingLabel={primaryHeadingLabel}
        />

        {isPaymentFlow && (
          <TransferAmountCard
            isEditingAmount={isEditingAmount}
            canEditAmount={canEditAmount}
            paymentAmount={paymentAmount}
            child={child}
            onAmountChange={handleAmountChange}
            onEditAmount={() => setIsEditingAmount(true)}
          />
        )}

        <BankDetailsCard
          bankDetails={activeBankDetails}
          schoolName={schoolName}
          paymentInfoCopy={paymentInfoCopy}
          onCopy={copyToClipboard}
        />

        <ReceiptUploader
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          receiptImage={receiptImage}
          receiptFileName={receiptBlob ? receiptFileName : null}
          receiptInputRef={receiptInputRef}
          onReceiptFileChange={handleReceiptFileChange}
          onRemoveReceipt={handleRemoveReceipt}
          onPickFromPhone={handlePickFromPhone}
        />

        <SubmitTransferButton
          isProcessing={isProcessing}
          paymentAmount={paymentAmount}
          onSubmit={handlePaymentSent}
        />
      </div>
    </Layout>
  );
};

export default PaymentMethodsScreen;
