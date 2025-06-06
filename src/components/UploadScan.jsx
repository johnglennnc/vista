import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { storage } from "../firebase/config";
import { v4 as uuidv4 } from "uuid";

function UploadScan() {
  const [status, setStatus] = useState("Idle");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = async (acceptedFiles) => {
    // Only take the first file (should be .zip)
    const file = acceptedFiles[0];
    if (!file || !file.name.endsWith(".zip")) {
      setStatus("❌ Only ZIP files are allowed.");
      return;
    }

    setUploading(true);
    setStatus("☁️ Uploading ZIP to Firebase Storage...");
    setProgress(0);

    try {
      const generatedFilename = `scan_${uuidv4()}.zip`;
      const auth = getAuth();
      const user = auth.currentUser;
      const zipRef = ref(storage, `temp-uploads/${generatedFilename}`);

      const uploadTask = uploadBytesResumable(zipRef, file, {
        customMetadata: {
          userId: user ? user.uid : "unknown",
        },
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setProgress(percent);
          },
          (error) => {
            setUploading(false);
            setStatus("❌ Upload error: " + error.message);
            reject(error);
          },
          () => {
            setStatus("✅ Upload complete. AI analysis will begin automatically.");
            setProgress(100);
            setUploading(false);
            resolve();
          }
        );
      });

      // No polling needed—backend triggers everything else.
    } catch (err) {
      setStatus(`❌ Upload failed: ${err.message}`);
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/zip": [".zip"] },
    disabled: uploading,
  });

  return (
    <div className="border border-gray-700 rounded p-6 bg-gray-800 text-center">
      <h2 className="text-xl font-semibold mb-4">📁 Upload CT Scan ZIP</h2>
      <div
        {...getRootProps()}
        className={`cursor-pointer p-6 border-2 border-dashed border-gray-500 rounded bg-gray-700 hover:bg-gray-600 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-lg">
          Drag & drop your <strong>.zip</strong> file here or click to select
        </p>
      </div>

      {uploading && (
        <div className="mt-4 text-sm text-blue-300">
          Progress: {progress}%<br />
          <div className="w-full h-2 bg-gray-700 rounded mt-2">
            <div className="h-2 bg-blue-500 rounded" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-300 whitespace-pre-wrap">
        {status}
      </div>
    </div>
  );
}

export default UploadScan;
