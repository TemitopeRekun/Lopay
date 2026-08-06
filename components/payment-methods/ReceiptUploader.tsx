import React from "react";

interface ReceiptUploaderProps {
  isUploading: boolean;
  uploadProgress: number;
  receiptImage: string | null;
  /**
   * Name of the chosen file. Set for every receipt; it is the ONLY thing shown
   * for a PDF, which has no `receiptImage` thumbnail to render.
   */
  receiptFileName?: string | null;
  receiptInputRef: React.RefObject<HTMLInputElement | null>;
  onReceiptFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveReceipt: () => void;
  onPickFromPhone: () => void;
}

/** Proof-of-transfer section: upload progress, preview and file picker. */
export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  isUploading,
  uploadProgress,
  receiptImage,
  receiptFileName,
  receiptInputRef,
  onReceiptFileChange,
  onRemoveReceipt,
  onPickFromPhone,
}) => (
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
      accept="image/*,application/pdf"
      onChange={onReceiptFileChange}
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
          onClick={onRemoveReceipt}
          aria-label="Remove receipt"
          className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      </div>
    ) : receiptFileName ? (
      <div className="relative rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined">description</span>
        </div>
        <p className="text-xs font-bold truncate pr-6">{receiptFileName}</p>
        <button
          onClick={onRemoveReceipt}
          aria-label="Remove receipt"
          className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <button
          onClick={onPickFromPhone}
          className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-text-secondary-light group"
        >
          <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
            <span className="material-symbols-outlined">photo_library</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-tight">
            Upload File
          </span>
        </button>
      </div>
    )}
  </div>
);
