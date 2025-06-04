// src/App.js
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Login from "./components/Login"; // Only Login stays imported
import { app } from "./firebase/config";

// --- UploadScan Component (Inline) ---
function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const mockRecentScans = [
  { id: 1, patient: "Smith", date: "2025-06-04", status: "Complete" },
  { id: 2, patient: "Johnson", date: "2025-06-03", status: "Analyzing" },
];

function UploadScan() {
  const fileInputRef = React.useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setProgress(0);
    setUploading(true);
    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setUploading(false);
          return 100;
        }
        return p + 10;
      });
    }, 150);
  };

  const handleBrowse = () => {
    fileInputRef.current.click();
  };

  const onFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  return (
    <div>
      {/* Upload Card */}
      <div
        className={classNames(
          "flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed",
          dragActive
            ? "border-cyan-400 bg-cyan-950 bg-opacity-30"
            : "border-slate-700 bg-slate-800 bg-opacity-60"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".zip"
          className="hidden"
          ref={fileInputRef}
          onChange={onFileChange}
        />
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4 shadow-xl">
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 17v-6m0 0l-2.5 2.5M12 11l2.5 2.5M17.657 16.657A8 8 0 1112 4a7.962 7.962 0 015.657 2.343"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-cyan-200"
            />
          </svg>
        </div>
        <p className="text-lg font-semibold text-cyan-300 mb-2">
          {dragActive ? "Drop ZIP to upload" : "Drag & Drop CT Scan ZIP Here"}
        </p>
        <button
          onClick={handleBrowse}
          className="mt-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl font-semibold text-white hover:scale-105 transition-all"
        >
          Browse Files
        </button>
        {selectedFile && (
          <div className="mt-5 w-full max-w-xs">
            <div className="flex justify-between mb-1 text-sm text-slate-400">
              <span>{selectedFile.name}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            {progress === 100 && (
              <div className="mt-2 text-green-400 text-sm font-medium">
                Upload complete!
              </div>
            )}
          </div>
        )}
      </div>
      {/* Recent Scans */}
      <div className="mt-12">
        <h3 className="text-lg font-bold mb-4 text-cyan-300">Recent Scans</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="px-4 py-2 text-left">Patient</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {mockRecentScans.map((scan) => (
                <tr
                  key={scan.id}
                  className="border-t border-slate-800 hover:bg-slate-800 transition"
                >
                  <td className="px-4 py-2 font-semibold">{scan.patient}</td>
                  <td className="px-4 py-2">{scan.date}</td>
                  <td className="px-4 py-2">
                    <span
                      className={classNames(
                        "px-3 py-1 rounded-full font-medium text-xs",
                        scan.status === "Complete"
                          ? "bg-green-900 text-green-400 border border-green-500"
                          : "bg-yellow-900 text-yellow-400 border border-yellow-600 animate-pulse"
                      )}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-cyan-300 hover:underline">View</button>
                  </td>
                </tr>
              ))}
              {mockRecentScans.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-slate-500 px-4 py-6 text-center">
                    No scans uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- AnalyzeScan Component (Inline) ---
const mockSlices = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  sliceNumber: i + 1,
  findings:
    i === 2
      ? ["Suspicious nodule detected on this slice."]
      : ["No abnormalities detected."],
}));

function AnalyzeScan() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slice = mockSlices[currentIndex];

  const prevSlice = () => setCurrentIndex((i) => Math.max(i - 1, 0));
  const nextSlice = () =>
    setCurrentIndex((i) => Math.min(i + 1, mockSlices.length - 1));

  return (
    <div className="flex flex-col md:flex-row gap-10">
      {/* Scan viewer */}
      <div className="flex-1 flex flex-col items-center bg-slate-800 rounded-2xl shadow-lg p-8">
        <div className="text-slate-400 font-medium mb-2">
          Slice {slice.sliceNumber} / {mockSlices.length}
        </div>
        <div className="w-72 h-72 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-md border-2 border-cyan-700 mb-5">
          <span className="text-5xl text-cyan-300 opacity-30 select-none">🩻</span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={prevSlice}
            disabled={currentIndex === 0}
            className="px-4 py-2 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-900 disabled:opacity-30"
          >
            Prev
          </button>
          <button
            onClick={nextSlice}
            disabled={currentIndex === mockSlices.length - 1}
            className="px-4 py-2 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-900 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
      {/* Findings panel */}
      <div className="w-full md:w-96">
        <h3 className="text-lg font-bold text-cyan-300 mb-3">AI Findings</h3>
        <div className="rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-6 min-h-[160px]">
          {slice.findings.map((finding, i) => (
            <div
              key={i}
              className={
                "mb-2 text-base " +
                (finding.includes("Suspicious")
                  ? "text-yellow-400 font-semibold"
                  : "text-green-400")
              }
            >
              {finding}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <button className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 font-bold text-white shadow-lg hover:scale-105 transition">
            Download Report (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <Login onLogin={(u) => setUser(u)} />
      </div>
    );
  }

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white">
      {/* Top Nav */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-slate-800 shadow-sm bg-opacity-80 backdrop-blur-xl">
        {/* Logo + Name */}
        <div className="flex items-center space-x-3">
          <div className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
            VISTA
          </div>
          <span className="text-slate-300 text-sm font-medium tracking-wide">
            Vision Integrated Scan & Treatment Assistant
          </span>
        </div>
        {/* Navigation */}
        <nav className="flex items-center space-x-2">
          <button
            className={`px-4 py-2 rounded-2xl transition-all font-semibold ${
              activeTab === "upload"
                ? "bg-gradient-to-r from-purple-600 to-cyan-500 shadow-lg"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
            onClick={() => setActiveTab("upload")}
          >
            Patient Upload
          </button>
          <button
            className={`px-4 py-2 rounded-2xl transition-all font-semibold ${
              activeTab === "analyze"
                ? "bg-gradient-to-r from-purple-600 to-cyan-500 shadow-lg"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
            onClick={() => setActiveTab("analyze")}
          >
            Scan Review
          </button>
        </nav>
        {/* Profile/Logout */}
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-pink-500 hover:from-red-700 hover:to-pink-600 shadow-md font-semibold"
        >
          Logout
        </button>
      </header>

      {/* Content Area */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Enhanced Welcome/User */}
        <section className="mb-12 flex flex-col md:flex-row items-center md:items-end gap-8">
          {/* Animated scan ring */}
          <div className="relative flex-shrink-0">
            {/* Animated pulse ring */}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-28 h-28 rounded-full bg-gradient-to-tr from-purple-600 via-cyan-400 to-purple-800 opacity-25 animate-ping"></span>
            </span>
            {/* VISTA Logo Circle */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 border-4 border-cyan-400 flex items-center justify-center shadow-lg relative z-10">
              <span className="text-3xl font-extrabold tracking-wide bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent select-none">
                V
              </span>
            </div>
          </div>
          {/* Welcome text */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welcome, <span className="text-cyan-400">{user.email}</span>
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-900 bg-opacity-70 border border-cyan-500 text-cyan-300 shadow-md">
                Secure – HIPAA Compliant
              </span>
            </div>
            <div className="text-slate-300 text-base md:text-lg mb-2">
              Vision Integrated Scan & Treatment Assistant
            </div>
            <div className="text-slate-400 text-sm md:text-base max-w-xl">
              Effortless, AI-powered CT scan analysis.<br className="hidden md:block" />
              Upload, review, and share results—all in a secure, medical-grade environment.
            </div>
          </div>
        </section>

        {/* Tab Content */}
        <div className="rounded-2xl shadow-xl bg-slate-900 bg-opacity-80 border border-slate-800 p-8 min-h-[420px] transition-all">
          {activeTab === "upload" && <UploadScan />}
          {activeTab === "analyze" && <AnalyzeScan />}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-500 py-4 border-t border-slate-800 bg-black bg-opacity-70">
        HIPAA-compliant | VISTA v1.0
      </footer>
    </div>
  );
}

export default App;
