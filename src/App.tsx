/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  Sparkles,
  Zap,
  Copy,
  Check,
  Download,
  Trash2,
  Upload,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  Columns,
  FileText,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Image as ImageIcon,
} from "lucide-react";
import { User } from "firebase/auth";
import { Header } from "./components/Header";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { HelpModal } from "./components/HelpModal";
import { DiffModal } from "./components/DiffModal";
import { DriveModal } from "./components/DriveModal";
import { PdfProcessingModal } from "./components/PdfProcessingModal";
import { SAMPLE_TEXTS } from "./data/samples";
import { ConversionHistoryItem, EncodingType } from "./types";
import { convertAndRepairBengali, detectBengaliEncoding } from "./utils/textRepair";
import { optimizeImageForOcr } from "./utils/imageUtils";
import { initAuth } from "./services/googleAuth";

const STORAGE_KEY = "bijoy_unicode_converter_history_v1";

export default function App() {
  const [inputText, setInputText] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [detectedType, setDetectedType] = useState<EncodingType>("empty");
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [isInstantActive, setIsInstantActive] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [copied, setCopied] = useState<boolean>(false);
  const [appliedRepairs, setAppliedRepairs] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Google Auth & Drive State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isDiffOpen, setIsDiffOpen] = useState<boolean>(false);
  const [isDriveOpen, setIsDriveOpen] = useState<boolean>(false);

  // PDF processing modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [selectedPdfBuffer, setSelectedPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>("");

  // History state
  const [history, setHistory] = useState<ConversionHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Initialize Firebase Auth listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }, [history]);

  // Show toast utility
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Detect encoding and run instant conversion whenever input changes
  useEffect(() => {
    if (!inputText.trim()) {
      setDetectedType("empty");
      setOutputText("");
      setAppliedRepairs([]);
      setWarningMessage(null);
      return;
    }
    const enc = detectBengaliEncoding(inputText);
    setDetectedType(enc);

    if (isInstantActive) {
      startTransition(() => {
        const result = convertAndRepairBengali(inputText);
        setOutputText(result.text);
        setAppliedRepairs(result.appliedRepairs);
      });
    }
  }, [inputText, isInstantActive]);

  // Instant Algorithmic Conversion Trigger
  const handleInstantConvert = () => {
    if (!inputText.trim()) return;
    const result = convertAndRepairBengali(inputText);
    setOutputText(result.text);
    setAppliedRepairs(result.appliedRepairs);
    setWarningMessage(null);
    showToast("সফলভাবে রূপান্তরিত হয়েছে!");
    saveToHistory(inputText, result.text, result.sourceType, "instant");
  };

  // AI-powered Deep Repair Trigger
  const handleAIConvert = async () => {
    if (!inputText.trim()) return;
    setIsLoadingAI(true);
    setWarningMessage(null);

    try {
      const response = await fetch("/api/convert-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();
      if (data.convertedText) {
        setOutputText(data.convertedText);
        if (data.warning) {
          setWarningMessage(data.warning);
        }
        if (data.appliedRepairs) {
          setAppliedRepairs(data.appliedRepairs);
        }
        showToast(data.fallback ? "অ্যালগরিদমিক রিপেয়ার সম্পন্ন!" : "AI ডিপ রিপেয়ার সম্পন্ন!");
        saveToHistory(inputText, data.convertedText, detectedType, "ai");
      }
    } catch (err: any) {
      console.error("AI conversion failed, executing local fallback:", err);
      const fallbackResult = convertAndRepairBengali(inputText);
      setOutputText(fallbackResult.text);
      setAppliedRepairs(fallbackResult.appliedRepairs);
      showToast("অফলাইন ইঞ্জিন দিয়ে রূপান্তর সম্পন্ন!");
      saveToHistory(inputText, fallbackResult.text, fallbackResult.sourceType, "instant");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Helper to save history items
  const saveToHistory = (
    input: string,
    output: string,
    type: EncodingType,
    mode: "ai" | "instant"
  ) => {
    if (!output.trim()) return;
    const newItem: ConversionHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      inputSnippet: input.slice(0, 70) + (input.length > 70 ? "..." : ""),
      fullInput: input,
      output: output,
      detectedType: type,
      mode: mode,
      wordCount: output.trim().split(/\s+/).filter(Boolean).length,
      charCount: output.length,
    };
    setHistory((prev) => [newItem, ...prev.filter((p) => p.fullInput !== input)].slice(0, 25));
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    showToast("ক্লিপবোর্ডে কপি হয়েছে!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear input & output
  const handleClear = () => {
    setInputText("");
    setOutputText("");
    setAppliedRepairs([]);
    setWarningMessage(null);
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  };

  // Download converted text as .txt
  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bangla_unicode_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("টেক্সট ফাইল ডাউনলোড হয়েছে!");
  };

  // File upload (.txt, .pdf)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (buffer) {
          setSelectedPdfBuffer(buffer);
          setSelectedPdfName(file.name);
          setIsPdfModalOpen(true);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setInputText(content);
          showToast(`'${file.name}' ফাইল লোড হয়েছে!`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  // Scanned page image upload (.jpg, .png, etc.)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingAI(true);
    showToast(`'${file.name}' ছবি প্রসেসিং চলছে...`);

    try {
      const { base64, mimeType } = await optimizeImageForOcr(file, 1500);
      let response: Response | null = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await fetch("/api/ocr-page", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType,
            }),
          });
          if (response.ok) break;
          if (response.status === 503 && attempt === 1) {
            showToast("পুনঃপ্রচেষ্টা চলছে...");
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          break;
        } catch (netErr) {
          lastErr = netErr;
          if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!response || !response.ok) {
        const errJson = await response?.json().catch(() => ({}));
        throw new Error(errJson?.error || lastErr?.message || "ছবি থেকে টেক্সট পড়া যায়নি");
      }

      const data = await response.json();
      if (data.text) {
        setInputText(data.text);
        setOutputText(data.text);
        if (data.appliedRepairs) {
          setAppliedRepairs(data.appliedRepairs);
        }
        showToast("ছবি থেকে টেক্সট সফলভাবে বের করা হয়েছে!");
        saveToHistory(`[ছবি: ${file.name}]`, data.text, "corrupted_unicode", "ai");
      }
    } catch (err: any) {
      console.error("Image OCR failed:", err);
      showToast("OCR ব্যর্থ: " + (err?.message || ""));
      setWarningMessage("ছবি থেকে টেক্সট রূপান্তরের জন্য সার্ভার বা এপিআই কি প্রয়োজন।");
    } finally {
      setIsLoadingAI(false);
      e.target.value = "";
    }
  };

  // Text to Speech
  const handleToggleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      showToast("আপনার ব্রাউজারে স্পিচ সিন্থেসিস সমর্থিত নয়");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!outputText.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(outputText);
    utterance.lang = "bn-BD";

    const voices = window.speechSynthesis.getVoices();
    const banglaVoice = voices.find((v) => v.lang.startsWith("bn"));
    if (banglaVoice) {
      utterance.voice = banglaVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAIConvert();
    }
  };

  // Load sample text
  const handleSelectSample = (sample: typeof SAMPLE_TEXTS[0]) => {
    setInputText(sample.text);
    showToast(`'${sample.title}' লোড হয়েছে`);
  };

  // Clear history
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    showToast("হিস্ট্রি মুছে ফেলা হয়েছে");
  };

  // Loaded from Drive or PDF
  const handleFileLoadedFromDrive = (
    filename: string,
    content: string | ArrayBuffer,
    isPdf: boolean
  ) => {
    if (isPdf && content instanceof ArrayBuffer) {
      setSelectedPdfBuffer(content);
      setSelectedPdfName(filename);
      setIsPdfModalOpen(true);
    } else if (typeof content === "string") {
      setInputText(content);
    }
  };

  const handlePdfTextExtracted = (text: string, mode: "extracted" | "ocr") => {
    setInputText(text);
    setOutputText(text);
    if (mode === "ocr") {
      showToast("PDF OCR সম্পন্ন হয়েছে!");
      saveToHistory(`[PDF OCR: ${selectedPdfName}]`, text, "corrupted_unicode", "ai");
    } else {
      showToast("PDF টেক্সট লোড হয়েছে!");
    }
  };

  // Stats
  const inputCharCount = inputText.length;
  const inputWordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
  const outputCharCount = outputText.length;
  const outputWordCount = outputText.trim() ? outputText.trim().split(/\s+/).filter(Boolean).length : 0;

  // Font size classes
  const fontClasses = {
    normal: "text-base leading-relaxed",
    large: "text-lg leading-relaxed",
    xlarge: "text-xl leading-relaxed",
  };

  // Detected type label & badge
  const getEncodingBadge = () => {
    switch (detectedType) {
      case "bijoy":
        return { text: "বিজয় কীবোর্ড (SutonnyMJ)", bg: "bg-amber-100 text-amber-800 border-amber-200" };
      case "corrupted_unicode":
        return { text: "ভাঙা ইউনিকোড / OCR", bg: "bg-red-100 text-red-800 border-red-200" };
      case "mixed":
        return { text: "মিশ্র ফরম্যাট", bg: "bg-purple-100 text-purple-800 border-purple-200" };
      case "valid_unicode":
        return { text: "শুদ্ধ ইউনিকোড", bg: "bg-blue-100 text-blue-800 border-blue-200" };
      default:
        return null;
    }
  };

  const badge = getEncodingBadge();

  return (
    <div className="min-h-screen bg-neutral-50/60 flex flex-col text-neutral-900 font-['Hind_Siliguri',sans-serif]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenDrive={() => setIsDriveOpen(true)}
        onTriggerPdfUpload={() => fileInputRef.current?.click()}
        historyCount={history.length}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-5">
        {/* Sample Selection & Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="text-xs font-semibold text-neutral-500 whitespace-nowrap pl-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              উদাহরণ:
            </span>
            {SAMPLE_TEXTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-700 border border-neutral-200/60 hover:border-emerald-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                {sample.title}
                <span className="ml-1.5 text-[10px] text-neutral-400">({sample.badge})</span>
              </button>
            ))}
          </div>

          {/* Quick Actions (Drive, PDF, Scanned Image, Live Toggle) */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-200">
            {/* Scanned Image Upload Trigger */}
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer transition-colors"
              title="স্ক্যান করা ছবি থেকে টেক্সট পড়ুন"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">ছবি OCR</span>
            </button>

            {/* Google Drive Trigger */}
            <button
              type="button"
              onClick={() => setIsDriveOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer transition-colors"
              title="গুগল ড্রাইভ"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">ড্রাইভ</span>
            </button>

            {/* Live Auto-Convert Toggle */}
            <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={isInstantActive}
                onChange={(e) => setIsInstantActive(e.target.checked)}
                className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>লাইভ রূপান্তর</span>
            </label>
          </div>
        </div>

        {/* Warning Notification if any */}
        {warningMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{warningMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setWarningMessage(null)}
              className="text-amber-700 hover:text-amber-900 font-semibold text-xs ml-2 cursor-pointer"
            >
              ঠিক আছে
            </button>
          </div>
        )}

        {/* Main Editor Grid (Two Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-[520px]">
          {/* LEFT: Input Box */}
          <div className="flex flex-col bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
            {/* Input Header */}
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-800 text-sm">
                  ইনপুট (বিজয় / টেক্সট / PDF)
                </span>
                {badge && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.bg}`}>
                    {badge.text}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Upload Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.pdf"
                  className="hidden"
                />
                <button
                  id="upload-file-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  title="ফাইল আপলোড (.txt, .pdf)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-[11px]">আপলোড</span>
                </button>

                {/* Clear Button */}
                {inputText && (
                  <button
                    id="clear-input-btn"
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="টেক্সট মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Input Textarea */}
            <div className="flex-1 p-4 relative flex flex-col">
              <textarea
                id="input-text-area"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="এখানে বিজয় টেক্সট লিখুন বা পেস্ট করুন (যেমন: Avwg evsjvq Mvb MvB)..."
                className="w-full flex-1 resize-none border-none p-0 text-neutral-800 focus:outline-hidden placeholder:text-neutral-400 font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Input Footer: Stats & Actions */}
            <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
              <div className="flex items-center gap-3">
                <span>{inputCharCount} অক্ষর</span>
                <span>•</span>
                <span>{inputWordCount} শব্দ</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Instant Convert Button */}
                <button
                  id="instant-convert-btn"
                  type="button"
                  onClick={handleInstantConvert}
                  disabled={!inputText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  title="তাৎক্ষণিক অ্যালগরিদমিক রূপান্তর"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>রূপান্তর করুন</span>
                </button>

                {/* AI Repair Button */}
                <button
                  id="ai-convert-btn"
                  type="button"
                  onClick={handleAIConvert}
                  disabled={!inputText.trim() || isLoadingAI}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="AI দিয়ে যুক্তবর্ণ ও ভাঙা ফন্ট মেরামত করুন"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLoadingAI ? "animate-spin" : ""}`} />
                  <span>{isLoadingAI ? "রিপেয়ার হচ্ছে..." : "AI ডিপ রিপেয়ার"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Output Box */}
          <div className="flex flex-col bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden transition-all">
            {/* Output Header */}
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-800 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  রূপান্তরিত ইউনিকোড ফলাফল
                </span>
                {outputText && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    শুদ্ধ বাংলা
                  </span>
                )}
              </div>

              {/* Output Actions */}
              <div className="flex items-center gap-1">
                {/* Font Size Adjuster */}
                <div className="flex items-center bg-neutral-100 rounded-lg p-0.5 mr-1 text-[11px] font-semibold text-neutral-600">
                  <button
                    type="button"
                    onClick={() => setFontSize("normal")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === "normal" ? "bg-white shadow-2xs text-neutral-900" : "hover:text-neutral-900"}`}
                    title="স্বাভাবিক ফন্ট"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize("large")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === "large" ? "bg-white shadow-2xs text-neutral-900" : "hover:text-neutral-900"}`}
                    title="বড় ফন্ট"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize("xlarge")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === "xlarge" ? "bg-white shadow-2xs text-neutral-900" : "hover:text-neutral-900"}`}
                    title="সর্বোচ্চ বড় ফন্ট"
                  >
                    A++
                  </button>
                </div>

                {/* Save to Drive Button */}
                <button
                  type="button"
                  onClick={() => setIsDriveOpen(true)}
                  disabled={!outputText}
                  className="p-1.5 text-neutral-500 hover:text-emerald-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="গুগল ড্রাইভে সংরক্ষণ করুন"
                >
                  <HardDrive className="w-4 h-4" />
                </button>

                {/* Diff Comparison Button */}
                <button
                  id="diff-btn"
                  type="button"
                  onClick={() => setIsDiffOpen(true)}
                  disabled={!outputText}
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="পাশাপাশি তুলনা করুন"
                >
                  <Columns className="w-4 h-4" />
                </button>

                {/* Speech Synthesis Button */}
                <button
                  id="tts-btn"
                  type="button"
                  onClick={handleToggleSpeak}
                  disabled={!outputText}
                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${isSpeaking ? "text-emerald-700 bg-emerald-50" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"}`}
                  title={isSpeaking ? "পড়া বন্ধ করুন" : "বাংলায় পড়ে শুনুন"}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Download Button */}
                <button
                  id="download-btn"
                  type="button"
                  onClick={handleDownload}
                  disabled={!outputText}
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="টেক্সট ফাইল হিসেবে ডাউনলোড করুন"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Copy Button */}
                <button
                  id="copy-output-btn"
                  type="button"
                  onClick={handleCopy}
                  disabled={!outputText}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${copied ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-neutral-900 hover:bg-neutral-800 text-white"}`}
                  title="কপি করুন"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "কপি হয়েছে!" : "কপি"}</span>
                </button>
              </div>
            </div>

            {/* Output Display */}
            <div className="flex-1 p-4 relative flex flex-col overflow-y-auto">
              {outputText ? (
                <div
                  id="converted-text-container"
                  className={`w-full flex-1 text-neutral-900 whitespace-pre-wrap select-all font-['Hind_Siliguri',sans-serif] ${fontClasses[fontSize]}`}
                >
                  {outputText}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-300 py-12 select-none">
                  <ArrowRightLeft className="w-10 h-10 mb-2 stroke-[1.2] opacity-60 text-neutral-400" />
                  <p className="text-sm font-medium text-neutral-400">
                    বামপাশে বিজয় টেক্সট পেস্ট করুন
                  </p>
                  <p className="text-xs text-neutral-400/80 mt-1">
                    তাৎক্ষণিকভাবে শুদ্ধ ইউনিকোড বাংলায় রূপান্তর দেখতে পাবেন
                  </p>
                </div>
              )}
            </div>

            {/* Output Footer: Stats & Applied Repairs */}
            <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <div className="flex items-center gap-3">
                <span>{outputCharCount} অক্ষর</span>
                <span>•</span>
                <span>{outputWordCount} শব্দ</span>
              </div>

              {appliedRepairs.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-hidden text-[11px] text-emerald-700 truncate max-w-sm">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{appliedRepairs[0]}</span>
                  {appliedRepairs.length > 1 && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1 rounded-sm shrink-0">
                      +{appliedRepairs.length - 1}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Badges Card */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-neutral-600">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 text-xs">নিখুঁত যুক্তবর্ণ</h4>
                <p className="text-neutral-500 mt-0.5">
                  বিভক্ত কার-চিহ্ন, ক্ষ, জ্ঞ, ত্ত, ষ্ণ ইত্যাদি স্বয়ংক্রিয়ভাবে মেরামত।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 text-xs">PDF টেক্সট এক্সট্রাক্ট</h4>
                <p className="text-neutral-500 mt-0.5">
                  ডিজিটাল বা স্ক্যান করা পিডিএফ থেকে সরাসরি ইউনিকোড রূপান্তর।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 text-xs">Google Drive ব্যাকআপ</h4>
                <p className="text-neutral-500 mt-0.5">
                  এক ক্লিকেই ড্রাইভ থেকে ডকুমেন্ট ওপেন করুন বা ফলাফল সংরক্ষণ করুন।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 text-xs">অফলাইন ইঞ্জিন</h4>
                <p className="text-neutral-500 mt-0.5">
                  সাধারণ কনভার্সনে কোনো ইন্টারনেট বা এপিআই কি প্রয়োজন নেই।
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 bg-white/70 py-3 text-center text-xs text-neutral-500">
        <p>বিজয় কিবোর্ড (SutonnyMJ) ও ভাঙা বাংলা ইউনিকোড টেক্সট রিপেয়ারিং টুল</p>
      </footer>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={(item) => {
          setInputText(item.fullInput);
          setOutputText(item.output);
          showToast("হিস্ট্রি থেকে টেক্সট লোড হয়েছে");
        }}
        onClear={handleClearHistory}
      />

      {/* Google Drive Modal */}
      <DriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        currentUser={currentUser}
        accessToken={accessToken}
        onAuthChanged={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        }}
        onFileLoaded={handleFileLoadedFromDrive}
        convertedText={outputText}
        showToast={showToast}
      />

      {/* PDF Processing Modal */}
      <PdfProcessingModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfArrayBuffer={selectedPdfBuffer}
        fileName={selectedPdfName}
        onTextExtracted={handlePdfTextExtracted}
        showToast={showToast}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Diff Modal */}
      <DiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        originalText={inputText}
        convertedText={outputText}
      />
    </div>
  );
}
