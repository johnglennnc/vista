import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Login from "./components/Login";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase/config";
import { app } from "./firebase/config";
import UploadScan from "./components/UploadScan";

// --- Helper Function ---
function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// --- AnalyzeScan Component (Inline) ---
function AnalyzeScan() {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchScans = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const scansRef = collection(db, "scans");
      const q = query(
        scansRef,
        where("status", "==", "processed"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const scanList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("Fetched scans:", scanList); // Debug log
      setScans(scanList);
    };

    fetchScans();
  }, []);

  const handleAnalyze = async () => {
    if (!selectedScanId) {
      alert("Please select a scan first.");
      return;
    }

    const scan = scans.find(s => s.id === selectedScanId);
    if (!scan?.slices?.length) {
      alert("No slices found for this scan.");
      return;
    }

    setAnalysisResult("🔄 Sending slices for AI analysis...");
    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");
      const idToken = await user.getIdToken();

      const sliceData = scan.slices.map(path => ({
        name: path.split('/').pop(),
        url: path
      }));

      const res = await fetch(
        " https://analyzeslices-3eolx7hkmq-uc.a.run.app", 
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ slices: sliceData }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch: ${errorText}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysisResult(
        data.results
          ? JSON.stringify(data.results, null, 2)
          : "No analysis results returned"
      );

      const scanDoc = doc(db, "scans", selectedScanId);
      await updateDoc(scanDoc, { aiAnalysis: data.results });

      setLoading(false);
    } catch (err) {
      setAnalysisResult(`❌ Error: ${err.message}`);
      setLoading(false);
      console.error("Analysis error:", err);
    }
  };

  return (
    <div className="border border-gray-700 rounded p-6 bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Analyze CT Scan</h2>

      <select
        className="bg-gray-900 text-white px-4 py-2 rounded mb-4 w-full"
        onChange={(e) => setSelectedScanId(e.target.value)}
        defaultValue=""
        disabled={loading}
      >
        <option value="" disabled>Select a scan...</option>
        {scans.map(scan => (
          <option key={scan.id} value={scan.id}>
            {scan.scanId || scan.id}
          </option>
        ))}
      </select>

      <button
        onClick={handleAnalyze}
        className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white mb-4 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        disabled={loading}
      >
        {loading ? "Running AI Analysis..." : "Run AI Analysis"}
      </button>

      {analysisResult && (
        <div className="mt-4 p-4 bg-gray-900 rounded text-green-400 whitespace-pre-line">
          {analysisResult}
        </div>
      )}
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
// for deployment