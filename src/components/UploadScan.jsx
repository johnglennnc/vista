import React, { useState } from "react";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { storage } from "../firebase/config";
import { v4 as uuidv4 } from "uuid";

function UploadScan() {
  const [status, setStatus] = useState("Idle");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      // ==== Auth & User Debug Block ====
      const auth = getAuth();
      const user = auth.currentUser;
      alert("Uploading as user: " + JSON.stringify(user)); // <--- force visible popup!
      setStatus("DEBUG: User = " + JSON.stringify(user));
      // ==== End Debug Block ====

      console.log("onDrop fired!", acceptedFiles);
      setUploading(true);
      setStatus("📦 Preparing upload...");
      setProgress(0);

      try {
        let zipBlob, generatedFilename;

        // --- Upload as-is if only a single .zip, else zip everything ---
        if (acceptedFiles.length === 1 && acceptedFiles[0].name.endsWith(".zip")) {
          zipBlob = acceptedFiles[0];
          generatedFilename = acceptedFiles[0].name;
        } else {
          const zip = new JSZip();
          for (let i = 0; i < acceptedFiles.length; i++) {
            zip.file(acceptedFiles[i].name, acceptedFiles[i]);
            setProgress(Math.round(((i + 1) / acceptedFiles.length) * 10));
          }
          zipBlob = await zip.generateAsync({ type: "blob" });
          generatedFilename = `scan_${uuidv4()}.zip`;
        }

        const zipRef = ref(storage, `temp-uploads/${generatedFilename}`);

        // --- Upload to Firebase Storage ---
        const uploadTask = uploadBytesResumable(zipRef, zipBlob, {
          customMetadata: {
            userId: user ? user.uid : "unknown",
          },
        });

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const percent =
                10 +
                Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 80);
              setProgress(percent);
              setStatus(`☁️ Uploading ZIP... ${percent}%`);
            },
            (error) => {
              setUploading(false);
              setStatus("❌ Upload error: " + error.message);
              reject(error);
            },
            async () => {
              setProgress(90);
              setStatus("⏳ Verifying upload in storage...");
              try {
                await getDownloadURL(zipRef);
                setStatus("✅ Upload complete! File is now in Storage.");
                setProgress(100);
                resolve();
              } catch (err) {
                setStatus(
                  "❌ Upload claimed complete, but not found in bucket: " +
                    err.message
                );
                setProgress(0);
                setUploading(false);
                reject(err);
              }
            }
          );
        });
      } catch (err) {
        setStatus(`❌ Upload or zipping failed: ${err.message}`);
        setUploading(false);
      }

      setUploading(false);
    },
    multiple: true,
    accept: {
      "application/zip": [".zip"],
      "application/dicom": [".dcm"],
      "application/octet-stream": [".dcm"],
    },
  });

  return (
    <div className="border border-gray-700 rounded p-6 bg-gray-800 text-center">
      <h2 className="text-xl font-semibold mb-4">📁 Upload CT ZIP or DICOM Files</h2>
      <div
        {...getRootProps()}
        className={`cursor-pointer p-6 border-2 border-dashed border-gray-500 rounded bg-gray-700 hover:bg-gray-600 transition ${
          uploading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-lg">
          Drag & drop your <strong>.zip</strong> or <strong>.dcm</strong> file(s) here or click to select
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
    </div>
  );
}

export default UploadScan;
