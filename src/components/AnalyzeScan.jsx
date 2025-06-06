import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

function AnalyzeScan() {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  
  // Subscribe to the scans collection for live updates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scans"), (snapshot) => {
      const scanList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScans(scanList);
    });
    return unsub;
  }, []);
  
  // Whenever selectedScanId or scans list changes, update analysisResult
  useEffect(() => {
    if (selectedScanId) {
      const scan = scans.find(s => s.id === selectedScanId);
      if (scan && scan.aiAnalysis) {
        setAnalysisResult(
          typeof scan.aiAnalysis === "string"
            ? scan.aiAnalysis
            : JSON.stringify(scan.aiAnalysis, null, 2)
        );
      } else {
        setAnalysisResult("");
      }
    }
  }, [selectedScanId, scans]);
  
  return (
    <div className="border border-gray-700 rounded p-6 bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Analyze CT Scan</h2>
      <select
        className="bg-gray-900 text-white px-4 py-2 rounded mb-4 w-full"
        onChange={(e) => setSelectedScanId(e.target.value)}
        value={selectedScanId}
      >
        <option value="" disabled>Select a scan...</option>
        {scans.map(scan => (
          <option key={scan.id} value={scan.id}>
            {scan.scanId || scan.id.slice(0, 12)}
            {scan.aiAnalysis ? "" : " (Pending analysis...)"}
          </option>
        ))}
      </select>
      {analysisResult && (
        <div className="mt-4 p-4 bg-gray-900 rounded text-green-400 whitespace-pre-line">
          <h3 className="font-bold mb-2">AI Analysis Result:</h3>
          <pre>{analysisResult}</pre>
        </div>
      )}
      {!analysisResult && selectedScanId && (
        <div className="mt-4 text-yellow-300">
          Waiting for AI analysis...
        </div>
      )}
    </div>
  );
}

export default AnalyzeScan;


