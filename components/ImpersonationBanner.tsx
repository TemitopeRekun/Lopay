import React from "react";

interface ImpersonationBannerProps {
  mode: "user" | "school";
  label: string;
  onExit: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  mode,
  label,
  onExit,
}) => {
  if (mode === "school") {
    return (
      <div className="bg-secondary text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">visibility</span>
          <p className="text-[10px] font-black uppercase tracking-widest">
            Managing {label}
          </p>
        </div>
        <button
          onClick={onExit}
          className="bg-white text-secondary px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
        >
          Exit School
        </button>
      </div>
    );
  }

  return (
    <div className="bg-purple-600 text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">visibility</span>
        <p className="text-[10px] font-black uppercase tracking-widest">
          Acting as {label}
        </p>
      </div>
      <button
        onClick={onExit}
        className="bg-white text-purple-600 px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
      >
        Exit Proxy
      </button>
    </div>
  );
};

