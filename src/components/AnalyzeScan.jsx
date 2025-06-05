import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, app, storage } from '../firebase/config';
import { getAuth } from "firebase/auth";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { getFunctions, httpsCallable } from 'firebase/functions';

function AnalyzeScan() {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "scans"));
        const scanList = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(scan => Array.isArray(scan.slices) && scan.slices.length > 0);
        setScans(scanList);
      } catch (err) {
        console.error("Error fetching scans:", err);
      }
    };

    fetchScans();
  }, []);

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result.split(',')[1];
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

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

    setAnalysisResult("🔄 Downloading and encoding slices...");
    setLoading(true);

    try {
      const sliceFiles = [];
      for (const storagePath of scan.slices) {
        const url = await getDownloadURL(storageRef(storage, storagePath));
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        sliceFiles.push({ name: storagePath.split('/').pop(), base64 });
      }

      setAnalysisResult("🔄 Sending to AI for analysis...");

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();

      const res = await fetch(
        "https://us-central1-vista-lifeimaging.cloudfunctions.net/api/analyzeSlices",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ slices: sliceFiles }),
        }
      );
      const data = await res.json();

      setAnalysisResult(
        data.results
          ? JSON.stringify(data.results, null, 2)
          : data.error
            ? `❌ Error: ${data.error}`
            : "No result"
      );

      const scanDoc = doc(db, "scans", selectedScanId);
      await updateDoc(scanDoc, { aiAnalysis: data.results });

      const functions = getFunctions(app);
      const deleteSliceImage = httpsCallable(functions, "deleteSliceImage");

      for (const imagePath of scan.slices) {
        try {
          await deleteSliceImage({ imagePath });
          console.log(`✅ Deleted ${imagePath}`);
        } catch (err) {
          console.error(`❌ Failed to delete ${imagePath}`, err);
        }
      }

      setLoading(false);
    } catch (err) {
      setAnalysisResult(`❌ Error: ${err.message}`);
      setLoading(false);
      console.error(err);
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
            {scan.scanId || scan.id.slice(0, 12)}
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

export default AnalyzeScan;

