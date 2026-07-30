import React from "react";

export interface BankFormData {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

interface SettlementAccountSectionProps {
  isEditing: boolean;
  editBankData: BankFormData;
  currentBankName?: string;
  currentAccountName?: string;
  currentAccountNumber?: string;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
  onEditBankDataChange: (data: BankFormData) => void;
  onCopyAccountNumber: () => void;
}

/** Bursary settlement account, toggling between a read-only card and edit form. */
export const SettlementAccountSection: React.FC<
  SettlementAccountSectionProps
> = ({
  isEditing,
  editBankData,
  currentBankName,
  currentAccountName,
  currentAccountNumber,
  onStartEditing,
  onCancel,
  onSave,
  onEditBankDataChange,
  onCopyAccountNumber,
}) => (
  <section className="animate-fade-in">
    <div className="flex items-center justify-between mb-3 px-1">
      <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
        Bursary Settlement Account
      </h3>
      {!isEditing && (
        <button
          onClick={onStartEditing}
          className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Update
        </button>
      )}
    </div>

    {isEditing ? (
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
                onEditBankDataChange({
                  ...editBankData,
                  bankName: e.target.value,
                })
              }
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold"
              placeholder={currentBankName || "e.g. Access Bank"}
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
                onEditBankDataChange({
                  ...editBankData,
                  accountName: e.target.value,
                })
              }
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold"
              placeholder={currentAccountName || "Full legal account name"}
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
                onEditBankDataChange({
                  ...editBankData,
                  accountNumber: e.target.value.replace(/\D/g, ""),
                })
              }
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold tracking-widest"
              placeholder={currentAccountNumber || "10 digit account number"}
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/10 text-text-secondary-light text-xs font-black uppercase"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
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
              {currentBankName || "Not Set"}
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
            {currentAccountName || "Not Set"}
          </span>
        </div>
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase">
              Account Number
            </span>
            <span className="text-2xl font-mono font-black tracking-widest text-primary">
              {currentAccountNumber || "Not Set"}
            </span>
          </div>
          <button
            onClick={onCopyAccountNumber}
            className="size-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              content_copy
            </span>
          </button>
        </div>
        <p className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-widest leading-relaxed">
          This account is visible to parents for all direct installment
          payments.
        </p>
      </div>
    )}
  </section>
);
