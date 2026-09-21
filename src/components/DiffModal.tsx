import React from "react";
import { X, Check } from "lucide-react";

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  convertedText: string;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  originalText,
  convertedText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div>
            <h3 className="font-bold text-neutral-900 text-lg">পাশাপাশি তুলনা (Comparison)</h3>
            <p className="text-xs text-neutral-500">মূল ইনপুট ও কনভার্টকৃত ইউনিকোড টেক্সটের সাদৃশ্য পরীক্ষা করুন</p>
          </div>
          <button
            id="close-diff-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 flex-1 overflow-hidden">
          {/* Left Column: Original */}
          <div className="p-5 flex flex-col overflow-hidden bg-neutral-50/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                মূল টেক্সট (Original)
              </span>
              <span className="text-xs text-neutral-400">{originalText.length} ক্যারেক্টার</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-white border border-neutral-200 text-sm font-mono text-neutral-800 whitespace-pre-wrap select-all">
              {originalText || <span className="text-neutral-400 italic">কোনো টেক্সট নেই</span>}
            </div>
          </div>

          {/* Right Column: Converted */}
          <div className="p-5 flex flex-col overflow-hidden bg-emerald-50/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> রূপান্তরিত ইউনিকোড (Unicode)
              </span>
              <span className="text-xs text-emerald-600">{convertedText.length} ক্যারেক্টার</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-white border border-emerald-200 text-base text-neutral-900 leading-relaxed whitespace-pre-wrap select-all font-['Hind_Siliguri',sans-serif]">
              {convertedText || <span className="text-neutral-400 italic">কোনো টেক্সট নেই</span>}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
