import React from "react";
import { X, AlertTriangle, Cpu, Zap, Keyboard } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-neutral-900 text-lg">ব্যবহারবিধি ও সাহায্য</h3>
          </div>
          <button
            id="close-help-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-neutral-600">
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5 text-base">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              বিজয় এবং ইউনিকোড কী?
            </h4>
            <p className="leading-relaxed">
              বিজয় কিবোর্ড SutonnyMJ ফন্টে লেখা টেক্সট মূলত ANSI এনকোডিং (যেমন: <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 text-xs font-mono">Avwg evsjvq Mvb MvB</code>)। এই কনভার্টার তাৎক্ষণিকভাবে এটিকে আন্তর্জাতিক স্ট্যান্ডার্ড ইউনিকোড বাংলায় রূপান্তর করে।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold mb-1">
                <Cpu className="w-4 h-4 text-emerald-600" />
                অ্যালগরিদমিক ইঞ্জিন
              </div>
              <p className="text-xs text-emerald-900/80 leading-normal">
                কোনো ইন্টারনেট বা টোকেন খরচ ছাড়াই তাৎক্ষণিক মিলিসেকেন্ডে অফলাইনে রূপান্তর করে।
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-1.5 text-neutral-800 font-semibold mb-1">
                <Zap className="w-4 h-4 text-neutral-600" />
                AI ডিপ রিপেয়ার
              </div>
              <p className="text-xs text-neutral-600 leading-normal">
                স্ক্যান করা OCR ডকুমেন্টের ভাঙা বা বিভ্রান্তিকর কার-চিহ্ন স্বয়ংক্রিয়ভাবে মেরামত করে।
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start gap-3">
            <Keyboard className="w-5 h-5 text-neutral-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-neutral-900 text-xs">কীবোর্ড শর্টকাট:</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                ইনপুট বক্সে লিখে <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-300 font-mono text-[11px] shadow-2xs">Ctrl + Enter</kbd> বা <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-300 font-mono text-[11px] shadow-2xs">Cmd + Enter</kbd> চাপলে স্বয়ংক্রিয় রূপান্তর শুরু হবে।
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
