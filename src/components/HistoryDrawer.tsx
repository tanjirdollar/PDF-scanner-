import React from "react";
import { X, Trash2, ArrowUpRight, Copy, Check, Clock } from "lucide-react";
import { ConversionHistoryItem } from "../types";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ConversionHistoryItem[];
  onSelect: (item: ConversionHistoryItem) => void;
  onClear: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-neutral-900 text-base">
              রূপান্তর ইতিহাস ({history.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                id="clear-history-btn"
                type="button"
                onClick={onClear}
                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                title="ইতিহাস মুছুন"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              id="close-history-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <Clock className="w-12 h-12 mx-auto stroke-[1.5] mb-2 opacity-50" />
              <p className="text-sm">কোনো পূর্ববর্তী রূপান্তর সংরক্ষিত নেই</p>
              <p className="text-xs text-neutral-400 mt-1">টেক্সট কনভার্ট করলে স্বয়ংক্রিয়ভাবে এখানে জমা হবে</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="p-3.5 rounded-xl border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer group bg-neutral-50/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-200/70 text-neutral-700">
                      {item.mode === "ai" ? "AI রিপেয়ার" : "ইনস্ট্যান্ট"}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, item.id, item.output)}
                      className="p-1 text-neutral-400 hover:text-emerald-700 hover:bg-white rounded transition-colors"
                      title="কপি করুন"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                </div>

                <p className="text-xs text-neutral-500 font-mono line-clamp-1 mb-1.5 bg-white p-1 rounded border border-neutral-100">
                  {item.inputSnippet}
                </p>
                <p className="text-sm text-neutral-900 font-medium line-clamp-2">
                  {item.output}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
