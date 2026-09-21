import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  HardDrive,
  FileText,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { User } from "firebase/auth";
import { DriveFile, listDriveFiles, downloadDriveFile, saveTextToDrive } from "../services/googleDrive";
import { googleSignIn, googleSignOut } from "../services/googleAuth";

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthChanged: (user: User | null, token: string | null) => void;
  onFileLoaded: (filename: string, content: string | ArrayBuffer, isPdf: boolean) => void;
  convertedText: string;
  showToast: (msg: string) => void;
}

export const DriveModal: React.FC<DriveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onAuthChanged,
  onFileLoaded,
  convertedText,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<"browse" | "save">("browse");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFileName, setSaveFileName] = useState<string>(`bangla_unicode_${Date.now()}`);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load files when modal opens or access token becomes available
  useEffect(() => {
    if (isOpen && accessToken) {
      loadFiles();
    }
  }, [isOpen, accessToken]);

  const loadFiles = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const driveFiles = await listDriveFiles(accessToken, {
        search: searchQuery,
        onlyPdfs: true,
      });
      setFiles(driveFiles);
    } catch (err: any) {
      setErrorMsg("ফাইল লোড করতে ব্যর্থ: " + (err?.message || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await googleSignIn();
      if (res) {
        onAuthChanged(res.user, res.accessToken);
        showToast("গুগলে সফলভাবে সাইন-ইন হয়েছে!");
      }
    } catch (err: any) {
      setErrorMsg("গুগল সাইন-ইন ব্যর্থ: " + (err?.message || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      onAuthChanged(null, null);
      setFiles([]);
      showToast("সাইন-আউট সম্পন্ন হয়েছে");
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSelectFile = async (file: DriveFile) => {
    if (!accessToken) return;
    setIsDownloadingId(file.id);
    try {
      const { arrayBuffer } = await downloadDriveFile(accessToken, file.id);
      const isPdf = file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        onFileLoaded(file.name, arrayBuffer, true);
      } else {
        const textDecoder = new TextDecoder("utf-8");
        const textContent = textDecoder.decode(arrayBuffer);
        onFileLoaded(file.name, textContent, false);
      }
      showToast(`'${file.name}' সফলভাবে লোড হয়েছে!`);
      onClose();
    } catch (err: any) {
      setErrorMsg("ফাইল ডাউনলোড করতে ব্যর্থ: " + (err?.message || ""));
    } finally {
      setIsDownloadingId(null);
    }
  };

  const handleConfirmSave = async () => {
    if (!accessToken || !convertedText.trim()) return;
    setIsSaving(true);
    setConfirmSaveOpen(false);
    try {
      const res = await saveTextToDrive(accessToken, saveFileName, convertedText);
      showToast(`'${res.name}' গুগলে ড্রাইভে সংরক্ষণ হয়েছে!`);
      setActiveTab("browse");
      loadFiles();
    } catch (err: any) {
      setErrorMsg("ফাইল সেভ করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base sm:text-lg">
                ক্লাউড স্টোরেজ (Google Drive)
              </h3>
              <p className="text-xs text-neutral-500">
                ড্রাইভ থেকে টেক্সট ও PDF ফাইল ওপেন করুন বা ফলাফল ব্যাকআপ রাখুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth Bar */}
        <div className="px-6 py-3 bg-neutral-100/60 border-b border-neutral-200 flex items-center justify-between text-xs">
          {currentUser ? (
            <div className="flex items-center gap-2">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "User"}
                  className="w-6 h-6 rounded-full border border-neutral-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {currentUser.displayName?.[0] || "U"}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium text-neutral-900">{currentUser.displayName || "Google User"}</span>
                <span className="text-[10px] text-neutral-500">{currentUser.email}</span>
              </div>
            </div>
          ) : (
            <div className="text-neutral-600">ড্রাইভ ব্যবহারের জন্য সাইন-ইন প্রয়োজন</div>
          )}

          {currentUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-neutral-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>সাইন-আউট</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-lg font-medium shadow-2xs transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-neutral-200 px-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("browse")}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 cursor-pointer transition-all ${
              activeTab === "browse"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            ফাইল ব্রাউজ করুন
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("save")}
            disabled={!convertedText.trim()}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "save"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            ড্রাইভে ব্যাকআপ রাখুন
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!currentUser ? (
            <div className="text-center py-12">
              <HardDrive className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h4 className="font-semibold text-neutral-800 text-base mb-1">
                গুগল ড্রাইভ কানেক্ট করুন
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5">
                আপনার গুগল ড্রাইভে থাকা বিজয় ডকুমেন্টস বা পিডিএফ সরাসরি এখানে রূপান্তর করতে সাইন-ইন করুন।
              </p>
              <button
                type="button"
                onClick={handleSignIn}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
              >
                গুগল দিয়ে প্রবেশ করুন
              </button>
            </div>
          ) : activeTab === "browse" ? (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadFiles()}
                    placeholder="ফাইলের নাম লিখে খুঁজুন..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadFiles}
                  disabled={isLoading}
                  className="p-2 border border-neutral-200 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer text-neutral-600"
                  title="রিফ্রেশ করুন"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* File List */}
              <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 max-h-72 overflow-y-auto bg-neutral-50/40">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    ড্রাইভ ফাইল খোঁজা হচ্ছে...
                  </div>
                ) : files.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    কোনো টেক্সট বা PDF ফাইল পাওয়া যায়নি
                  </div>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 flex items-center justify-between hover:bg-emerald-50/50 transition-colors group cursor-pointer"
                      onClick={() => handleSelectFile(file)}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                          {file.mimeType === "application/pdf" ? (
                            <FileText className="w-4 h-4 text-red-500" />
                          ) : (
                            <FileCheck className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-neutral-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-neutral-400">
                            {file.mimeType === "application/pdf" ? "PDF ডকুমেন্ট" : "টেক্সট ডকুমেন্ট"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDownloadingId === file.id}
                        className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-white group-hover:bg-emerald-600 group-hover:text-white border border-emerald-200 group-hover:border-emerald-600 rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs"
                      >
                        {isDownloadingId === file.id ? "লোড হচ্ছে..." : "ওপেন করুন"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Save to Drive tab */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  ফাইলের নাম নির্ধারণ করুন:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saveFileName}
                    onChange={(e) => setSaveFileName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="ফাইলের নাম লিখুন..."
                  />
                  <span className="text-xs text-neutral-500">.txt</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-600 space-y-1">
                <p className="font-semibold text-neutral-800">সংরক্ষণ বিবরণী:</p>
                <p>মোট অক্ষর: {convertedText.length}</p>
                <p>শব্দ সংখ্যা: {convertedText.trim().split(/\s+/).filter(Boolean).length}</p>
                <p className="text-neutral-500 text-[11px] pt-1">
                  এটি সরাসরি আপনার Google Drive-এর রুট ডিরেক্টরিতে টেক্সট ফাইল (.txt) আকারে সংরক্ষিত হবে।
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSaveOpen(true)}
                disabled={isSaving || !convertedText.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "সংরক্ষণ করা হচ্ছে..." : "ড্রাইভে সংরক্ষণ করুন"}
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {confirmSaveOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-neutral-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>নিশ্চিতকরণ</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                আপনি কি নিশ্চিতভাবে এই রূপান্তরিত বাংলা টেক্সটটি Google Drive-এ <strong>"{saveFileName}.txt"</strong> হিসেবে সেভ করতে চান?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmSaveOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  হ্যাঁ, সংরক্ষণ করুন
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
