import React from "react";

interface InstitutionalLinkCardProps {
  schoolName: string;
}

/** Card linking the user to their verified school membership. */
export const InstitutionalLinkCard: React.FC<InstitutionalLinkCardProps> = ({
  schoolName,
}) => (
  <section className="animate-fade-in">
    <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-3 px-1">
      Institutional Link
    </h3>
    <div className="p-5 bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
      <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
        <span className="material-symbols-outlined filled">school</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-black text-text-primary-light dark:text-text-primary-dark leading-tight">
          {schoolName}
        </p>
        <p className="text-[10px] text-text-secondary-light font-bold uppercase mt-1">
          Verified Member
        </p>
      </div>
    </div>
  </section>
);
