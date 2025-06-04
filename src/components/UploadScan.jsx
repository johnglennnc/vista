import React, { useState } from "react";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase/config";
import { getAuth } from "firebase/auth";

function UploadScan() {
  const [status, setStatus] = useState("Idle");
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = async (acceptedFiles) => {
    setUploading(true);
    setStatus("🗜️ Zipping DICOM slices...");

    try {
      // Zip the slices for storage
      const zip = new JSZip();
      acceptedFiles.forEach((file, idx) => {
        zip.file(`slice_${idx + 1}.dcm`, file);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      setStatus("☁️ Uploading ZIP to Firebase Storage...");

      // Upload ZIP to Firebase Storage
      const zipRef = ref(storage, `ct_scans/scan_${Date.now()}.zip`);
      await uploadBytes(zipRef, zipBlob);

      setStatus("📦 Unzipping locally & preparing for AI analysis...");

      // Unzip locally to send to the AI endpoint
      const zipData = await JSZip.loadAsync(zipBlob);
      const sliceFiles = [];
      await Promise.all(
        Object.keys(zipData.files).map(async (filename) => {
          const file = zipData.files[filename];
          if (!file.dir) {
            const base64 = await file.async("base64");
            sliceFiles.push({ name: filename, base64 });
          }
        })
      );

      setStatus("🔑 Getting auth token...");
      // Get Firebase ID token for authenticated API call
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setStatus("❌ You must be signed in to upload.");
        setUploading(false);
        return;
      }
      const idToken = await user.getIdToken();

      setStatus("🤖 Sending to AI for analysis...");
      // Send slices to your backend for analysis WITH AUTH
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

      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        // Try to get error payload from backend
        let errorPayload;
        try {
          errorPayload = await res.text();
        } catch {
          errorPayload = "(unable to read error response)";
        }
        throw new Error(
          `HTTP ${res.status}: ${res.statusText}\n${errorPayload}`
        );
      }

      setAiResult(data.results || data.error || "No result");
      setStatus("✅ Analysis complete.");
    } catch (err) {
      // Show ALL error details
      let details = "";
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        details = "\nNetwork or CORS error — check browser dev tools > Network tab and function logs for details.";
      } else if (err.stack) {
        details = `\nStack:\n${err.stack}`;
      } else {
        details = "\n" + JSON.stringify(err, null, 2);
      }
      setStatus(`❌ Upload or analysis failed: ${err.message || err}\n${details}`);
      console.error("Full error details:", err);
    }
    setUploading(false);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "application/dicom": [".dcm"] },
  });

  return (
    <div className="border border-gray-700 rounded p-6 bg-gray-800 text-center">
      <h2 className="text-xl font-semibold mb-4">📁 Upload CT Scan Slices</h2>

      <div
        {...getRootProps()}
        className={`cursor-pointer p-6 border-2 border-dashed border-gray-500 rounded bg-gray-700 hover:bg-gray-600 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-lg">
          Drag & drop your <strong>.dcm</strong> files here or click to select
        </p>
      </div>

      <div className="mt-4 text-sm text-gray-300 whitespace-pre-wrap">{status}</div>

      {aiResult && (
        <div className="mt-6 text-left text-sm bg-gray-900 p-4 rounded overflow-x-auto">
          <h3 className="font-bold mb-2">AI Analysis Result:</h3>
          <pre>{JSON.stringify(aiResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default UploadScan;

