import React, { useState } from "react";
import {
  X,
  FileText,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Info,
} from "lucide-react";
import {
  extractTextFromPdf,
  renderPdfPageToImage,
  checkPdfTextLayer,
  extractSinglePageText,
} from "../services/pdfService";
import { convertAndRepairBengali } from "../utils/textRepair";

interface PdfProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfArrayBuffer: ArrayBuffer | null;
  fileName: string;
  onTextExtracted: (text: string, appliedMode: "extracted" | "ocr") => void;
  showToast: (msg: string) => void;
}

export const PdfProcessingModal: React.FC<PdfProcessingModalProps> = ({
  isOpen,
  onClose,
  pdfArrayBuffer,
  fileName,
  onTextExtracted,
  showToast,
}) => {
  const [totalPages, setTotalPages] = useState<number>(0);
  const [hasEmbeddedText, setHasEmbeddedText] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<"all" | "first10" | "firstPage">("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && pdfArrayBuffer) {
      checkPdfTextLayer(pdfArrayBuffer)
        .then((info) => {
          setTotalPages(info.totalPages);
          setHasEmbeddedText(info.hasText);
        })
        .catch((err) => {
          console.error("Could not load pdf info:", err);
          setTotalPages(1);
        });
    }
  }, [isOpen, pdfArrayBuffer]);

  if (!isOpen || !pdfArrayBuffer) return null;

  // Mode 1: Fast Embedded Text Extraction & Repair
  const handleFastExtract = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setProgressText("ডিজিটাল টেক্সট লেয়ার পড়া হচ্ছে...");
    try {
      const result = await extractTextFromPdf(pdfArrayBuffer, (current, total) => {
        setProgressText(`পৃষ্ঠা ${current}/${total} নিষ্কাশন করা হচ্ছে...`);
      });

      if (!result.fullText.trim() || result.isScannedOrImageOnly) {
        setErrorMsg(
          "এই PDF-টিতে কোনো ডিজিটাল টেক্সট পাওয়া যায়নি (এটি স্ক্যান করা ইমেজ PDF হতে পারে)। অনুগ্রহ করে 'AI ইমেজ OCR' মোড ব্যবহার করুন।"
        );
        setIsProcessing(false);
        return;
      }

      onTextExtracted(result.fullText, "extracted");
      showToast(`${result.totalPages} পৃষ্ঠার টেক্সট সফলভাবে নিষ্কাশন করা হয়েছে!`);
      onClose();
    } catch (err: any) {
      setErrorMsg("PDF পড়তে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setIsProcessing(false);
    }
  };

  // Mode 2: Multimodal AI Scanned OCR with Resilient Retries & Text-Layer Fallback
  const handleAiOcr = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    let startPage = 1;
    let endPage = totalPages || 1;

    if (selectedRange === "firstPage") {
      endPage = 1;
    } else if (selectedRange === "first10") {
      endPage = Math.min(10, totalPages || 10);
    }

    const aggregatedTexts: string[] = [];
    let failedPages = 0;

    try {
      for (let p = startPage; p <= endPage; p++) {
        setProgressText(`পৃষ্ঠা ${p}/${endPage} OCR প্রসেসিং চলছে...`);

        // Render page with optimized dimensions (max ~1400px, quality 0.8)
        let img;
        try {
          img = await renderPdfPageToImage(pdfArrayBuffer, p, 1400);
        } catch (rErr) {
          console.warn(`Page ${p} render failed, attempting text layer fallback`);
        }

        let pageExtracted = "";
        let succeeded = false;

        // Try calling OCR with up to 2 client-side retry attempts if server reports high demand (503)
        if (img) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const res = await fetch("/api/ocr-page", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  imageBase64: img.base64,
                  mimeType: img.mimeType,
                }),
              });

              if (res.ok) {
                const data = await res.json();
                pageExtracted = (data.text || "").trim();
                succeeded = true;
                break;
              }

              const errData = await res.json().catch(() => ({}));
              if (res.status === 429) {
                setProgressText(`পৃষ্ঠা ${p}/${endPage}: কোটা কুলডাউন...`);
                break;
              } else if (res.status === 503 && attempt === 1) {
                setProgressText(`পৃষ্ঠা ${p}/${endPage}: পুনঃপ্রচেষ্টা চলছে...`);
                await new Promise((r) => setTimeout(r, 1500));
                continue;
              } else {
                console.warn(`Page ${p} OCR returned status ${res.status}:`, errData?.error);
                break;
              }
            } catch (networkErr) {
              console.warn(`Page ${p} OCR network error (attempt ${attempt}):`, networkErr);
              if (attempt === 1) {
                await new Promise((r) => setTimeout(r, 1200));
              }
            }
          }
        }

        // If OCR didn't succeed, fallback to extracting digital text layer from that page if available
        if (!succeeded) {
          try {
            const rawPageText = await extractSinglePageText(pdfArrayBuffer, p);
            if (rawPageText && rawPageText.trim().length > 10) {
              const repaired = convertAndRepairBengali(rawPageText);
              pageExtracted = `[ডিজিটাল টেক্সট লেয়ার]\n` + repaired.text;
              succeeded = true;
            }
          } catch (fbErr) {
            console.warn(`Page ${p} fallback failed:`, fbErr);
          }
        }

        if (succeeded && pageExtracted) {
          aggregatedTexts.push(`--- পৃষ্ঠা ${p} ---\n` + pageExtracted);
        } else {
          failedPages++;
          aggregatedTexts.push(
            `--- পৃষ্ঠা ${p} ---\n[পৃষ্ঠাটি পড়া সম্ভব হয়নি]`
          );
        }

        // Pacing delay between pages
        if (p < endPage) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }

      const combinedText = aggregatedTexts.join("\n\n");
      if (aggregatedTexts.length > 0 && combinedText.trim()) {
        onTextExtracted(combinedText, "ocr");
        if (failedPages > 0) {
          showToast(`মোট ${endPage - failedPages} পৃষ্ঠার টেক্সট বের করা হয়েছে!`);
        } else {
          showToast(`${endPage} পৃষ্ঠার OCR সফল হয়েছে!`);
        }
        onClose();
      } else {
        throw new Error("কোনো টেক্সট পাওয়া যায়নি");
      }
    } catch (err: any) {
      console.error("AI OCR error:", err);
      setErrorMsg(
        err?.message || "PDF প্রসেস করার সময় ত্রুটি ঘটেছে"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">PDF টেক্সট নিষ্কাশন</h3>
              <p className="text-xs text-neutral-500 truncate max-w-xs">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
            <div className="flex items-center gap-2 text-neutral-700">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>মোট পৃষ্ঠা:</span>
              <strong className="text-neutral-900">{totalPages || "গণনা হচ্ছে..."}</strong>
            </div>
            <span className="text-[11px] text-neutral-500">স্বয়ংক্রিয় ডিটেকশন</span>
          </div>

          {hasEmbeddedText === true && (
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">ডিজিটাল টেক্সট উপস্থিত:</strong> এই ফাইলটিতে ডিজিটাল ফন্ট রয়েছে, তাই 'দ্রুত নিষ্কাশন' ব্যবহার করলে সবচেয়ে নিখুঁত ও দ্রুত ফল পাবেন।
              </div>
            </div>
          )}

          {hasEmbeddedText === false && (
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">স্ক্যান করা ডকুমেন্ট:</strong> এতে ডিজিটাল টেক্সট লেয়ার নেই। 'AI ইমেজ OCR' নির্বাচন করুন।
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-sm font-semibold text-neutral-800">{progressText}</p>
              <p className="text-xs text-neutral-400">অনুগ্রহ করে অপেক্ষা করুন...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  পৃষ্ঠা সীমা নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRange("all")}
                    className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                      selectedRange === "all"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    সকল পৃষ্ঠা ({totalPages})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRange("first10")}
                    className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                      selectedRange === "first10"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    প্রথম ১০ পৃষ্ঠা
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRange("firstPage")}
                    className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                      selectedRange === "firstPage"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    শুধু প্রথম পৃষ্ঠা
                  </button>
                </div>
              </div>

              {/* Two Option Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleFastExtract}
                  className="w-full p-3.5 rounded-xl border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer flex items-start gap-3 bg-neutral-50/50"
                >
                  <div className="p-2 rounded-lg bg-white border border-neutral-200 text-amber-600 shrink-0 group-hover:border-emerald-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 group-hover:text-emerald-800">
                      ১. দ্রুত ডিজিটাল টেক্সট এক্সট্রাকশন
                    </h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                      সাধারণ পিডিএফ ফাইলের ফন্ট থেকে সরাসরি সেকেন্ডের মধ্যে টেক্সট বের করে মেরামত করে।
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleAiOcr}
                  className="w-full p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/70 text-left transition-all group cursor-pointer flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      ২. AI ভিশন OCR (স্ক্যান করা পৃষ্ঠার জন্য)
                    </h4>
                    <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-normal">
                      স্ক্যান করা বা বইয়ের পাতার ছবি বিশ্লেষণ করে নিখুঁত ইউনিকোড বাংলা রূপান্তর।
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
