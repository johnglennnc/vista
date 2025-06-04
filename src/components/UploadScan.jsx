import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase/config";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { app } from "../firebase/config";

const db = getFirestore(app);

function UploadScan() {
  const [status, setStatus] = useState("Idle");
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const unsubscribeRef = useRef(null);

  // Clean up Firestore listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  // Start polling for result in Firestore after upload
  const pollForResult = (uploadedFilename) => {
    setStatus("🕵️ Waiting for AI analysis result...");
    const q = query(
      collection(db, "scan-results"),
      where("filename", "==", uploadedFilename)
    );
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setAiResult(doc.data().result);
        setStatus("✅ AI analysis result received.");
        unsubscribeRef.current();
      }
    });
  };

  const onDrop = async (acceptedFiles) => {
    setUploading(true);
    setStatus("🗜️ Zipping DICOM slices...");
    setProgress(0);
    setAiResult(null);

    try {
      // Zip the slices for storage
      const zip = new JSZip();
      acceptedFiles.forEach((file, idx) => {
        zip.file(`slice_${idx + 1}.dcm`, file);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const generatedFilename = `scan_${Date.now()}.zip`;

      setStatus("☁️ Uploading ZIP to Firebase Storage...");

      // Upload ZIP to Firebase Storage (temp-uploads)
      const zipRef = ref(storage, `temp-uploads/${generatedFilename}`);
      const uploadTask = uploadBytesResumable(zipRef, zipBlob);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setProgress(percent);
            setStatus(`☁️ Uploading ZIP to Firebase Storage... ${percent}%`);
          },
          (error) => {
            setUploading(false);
            setStatus("❌ Upload error: " + error.message);
            reject(error);
          },
          () => {
            setStatus("📦 File uploaded. Waiting for AI analysis...");
            setProgress(100);
            resolve();
          }
        );
      });

      // Start polling Firestore for analysis result by filename
      pollForResult(generatedFilename);
    } catch (err) {
      let details = "";
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        details =
          "\nNetwork or CORS error — check browser dev tools > Network tab and function logs for details.";
      } else if (err.stack) {
        details = `\nStack:\n${err.stack}`;
      } else {
        details = "\n" + JSON.stringify(err, null, 2);
      }
      setStatus(
        `❌ Upload or analysis failed: ${err.message || err}\n${details}`
      );
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
          Uploading: {progress}%<br />
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

