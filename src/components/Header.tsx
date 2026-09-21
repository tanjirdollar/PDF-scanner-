import React from "react";
import { History, HelpCircle, CheckCircle2, HardDrive, FileText } from "lucide-react";
import { User } from "firebase/auth";

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenHelp: () => void;
  onOpenDrive: () => void;
  onTriggerPdfUpload: () => void;
  historyCount: number;
  currentUser: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenHelp,
  onOpenDrive,
  onTriggerPdfUpload,
  historyCount,
  currentUser,
}) => {
  return (
    <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-sm shadow-emerald-500/20">
            ব
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
                বিজয় টু ইউনিকোড কনভার্টার
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                স্মার্ট রিপেয়ার
              </span>
            </div>
            <p className="text-xs text-neutral-500 hidden md:block">
              বিজয় কিবোর্ড (SutonnyMJ), টেক্সট, PDF ও ইমেজ থেকে শুদ্ধ ইউনিকোড
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PDF Upload Button */}
          <button
            id="header-pdf-btn"
            type="button"
            onClick={onTriggerPdfUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer"
            title="PDF ফাইল আপলোড করুন"
          >
            <FileText className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">PDF আপলোড</span>
          </button>

          {/* Google Drive Button */}
          <button
            id="google-drive-btn"
            type="button"
            onClick={onOpenDrive}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer border ${
              currentUser
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70"
                : "bg-white border-neutral-200/80 text-neutral-700 hover:bg-neutral-50"
            }`}
            title="গুগল ড্রাইভে সংরক্ষণ বা ওপেন করুন"
          >
            <HardDrive className={`w-4 h-4 ${currentUser ? "text-emerald-600" : "text-neutral-500"}`} />
            <span className="hidden md:inline">Google Drive</span>
            {currentUser && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="লগইন সক্রিয়" />
            )}
          </button>

          {/* History Button */}
          <button
            id="history-btn"
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer"
            title="কনভার্সন হিস্ট্রি"
          >
            <History className="w-4 h-4 text-neutral-500" />
            <span className="hidden sm:inline">হিস্ট্রি</span>
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-600 text-white">
                {historyCount}
              </span>
            )}
          </button>

          {/* Help Button */}
          <button
            id="help-btn"
            type="button"
            onClick={onOpenHelp}
            className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            title="সাহায্য ও নিয়মাবলী"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
