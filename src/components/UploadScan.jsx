import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable } from "firebase/storage";
import { getFirestore, collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { storage } from "../firebase/config";
import { app } from "../firebase/config";
import { addDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

const db = getFirestore(app);

function UploadScan() {
  const [status, setStatus] = useState("Idle");
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const pollForResult = (uploadedFilename) => {
    setStatus("🕵️ Waiting for AI analysis result...");
    const q = query(collection(db, "scan-results"), where("filename", "==", uploadedFilename));
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const resultData = doc.data();
setAiResult(resultData.results || resultData.result);
setStatus("✅ AI analysis result received.");

const addRealScan = async () => {
  try {
    await addDoc(collection(db, "scans"), {
      scanId: resultData.filename || uploadedFilename,
      slices: resultData.slices || [],
      aiAnalysis: resultData.results || resultData.result,
      createdAt: new Date()
    });
  } catch (err) {
    console.error("Error writing to scans collection:", err);
  }
};

addRealScan();  // ✅ Now it's properly async

unsubscribeRef.current();

      }
    });
  };

  const onDrop = async (acceptedFiles) => {
    setUploading(true);
    setStatus("📦 Zipping DICOM files...");
    setProgress(0);
    setAiResult(null);

    try {
      const zip = new JSZip();
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        zip.file(file.name, file);
        setProgress(Math.round(((i + 1) / acceptedFiles.length) * 25)); // 25% for zipping
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const generatedFilename = `scan_${uuidv4()}.zip`;
      const zipRef = ref(storage, `temp-uploads/${generatedFilename}`);

      const uploadTask = uploadBytesResumable(zipRef, zipBlob);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent = 25 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 75);
            setProgress(percent);
            setStatus(`☁️ Uploading ZIP to Firebase Storage... ${percent}%`);
          },
          (error) => {
            setUploading(false);
            setStatus("❌ Upload error: " + error.message);
            reject(error);
          },
          () => {
            setStatus("📤 Upload complete. Waiting for AI analysis...");
            setProgress(100);
            resolve();
            
          }
        );
      });

      // ✅ Add to Firestore 'scans' collection
      const auth = getAuth();
      const user = auth.currentUser;
      await addDoc(collection(db, "scans"), {
        scanId: generatedFilename,
        userId: user?.uid || "unknown",
        status: "uploaded",
        createdAt: serverTimestamp(),
        slices: [],
      });

      pollForResult(generatedFilename);
    } catch (err) {
      setStatus(`❌ Upload or zipping failed: ${err.message}`);
      setUploading(false);
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
        className={`cursor-pointer p-6 border-2 border-dashed border-gray-500 rounded bg-gray-700 hover:bg-gray-600 transition ${
          uploading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-lg">
          Drag & drop your <strong>.dcm</strong> files here or click to select
        </p>
      </div>

      {uploading && (
        <div className="mt-4 text-sm text-blue-300">
          Progress: {progress}%<br />
          <div className="w-full h-2 bg-gray-700 rounded mt-2">
            <div
              className="h-2 bg-blue-500 rounded"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-300 whitespace-pre-wrap">
        {status}
      </div>

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
