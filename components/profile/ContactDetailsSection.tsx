import React from "react";

interface ContactDetailsSectionProps {
  isEditing: boolean;
  phoneInput: string;
  currentPhoneNumber?: string;
  /** Validation message shown under the input, or null when it's acceptable. */
  error: string | null;
  isSaving: boolean;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
  onPhoneInputChange: (value: string) => void;
}

/**
 * Contact phone number, toggling between a read-only row and an edit form.
 * Google sign-in never supplies a number, so for those parents this is the only
 * way it ever gets set.
 */
export const ContactDetailsSection: React.FC<ContactDetailsSectionProps> = ({
  isEditing,
  phoneInput,
  currentPhoneNumber,
  error,
  isSaving,
  onStartEditing,
  onCancel,
  onSave,
  onPhoneInputChange,
}) => (
  <section className="animate-fade-in">
    <div className="flex items-center justify-between mb-3 px-1">
      <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
        Contact Details
      </h3>
      {!isEditing && (
        <button
          onClick={onStartEditing}
          className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          {currentPhoneNumber ? "Update" : "Add"}
        </button>
      )}
    </div>

    {isEditing ? (
      <div className="p-6 bg-white dark:bg-card-dark rounded-[32px] border-2 border-primary/30 shadow-xl space-y-4 animate-scale-in">
        <div>
          <label className="text-[9px] font-black text-text-secondary-light uppercase tracking-widest mb-1 block">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => onPhoneInputChange(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold"
            placeholder="e.g. 08012345678"
          />
          {error && (
            <p className="mt-2 text-[10px] font-bold text-danger">{error}</p>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/10 text-text-secondary-light text-xs font-black uppercase disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !!error}
            className="flex-1 h-12 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    ) : (
      <div className="p-5 bg-white dark:bg-card-dark rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">
            call
          </span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[9px] font-bold text-text-secondary-light uppercase tracking-widest">
            Phone Number
          </span>
          <span className="text-sm font-bold truncate">
            {currentPhoneNumber || "Not set"}
          </span>
        </div>
      </div>
    )}
  </section>
);
