import React, { useState, useRef, useEffect } from "react";
import dicomParser from "dicom-parser";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase/config";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { app } from "../firebase/config";

const db = getFirestore(app);

// Helper: Convert DICOM file to base64 PNG (grayscale only, basic)
async function dicomFileToPng(file) {
  const buffer = await file.arrayBuffer();
  const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
  const pixelDataElement = dataSet.elements.x7fe00010;
  if (!pixelDataElement) throw new Error("No pixel data found in DICOM.");
  const pixelData = new Uint8Array(
    dataSet.byteArray.buffer,
    pixelDataElement.dataOffset,
    pixelDataElement.length
  );
  const rows = dataSet.uint16("x00280010");
  const cols = dataSet.uint16("x00280011");

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(cols, rows);

  for (let i = 0; i < pixelData.length; i++) {
    const val = pixelData[i];
    imgData.data[i * 4 + 0] = val;
    imgData.data[i * 4 + 1] = val;
    imgData.data[i * 4 + 2] = val;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Return base64 PNG (no data:image/png;base64, prefix)
  return canvas.toDataURL("image/png").split(",")[1];
}

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
        setAiResult(doc.data().results || doc.data().result);
        setStatus("✅ AI analysis result received.");
        unsubscribeRef.current();
      }
    });
  };

  const onDrop = async (acceptedFiles) => {
    setUploading(true);
    setStatus("🖼️ Converting DICOM slices to PNG...");
    setProgress(0);
    setAiResult(null);

    try {
      // Convert DICOMs to PNGs
      const zip = new JSZip();
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const pngBase64 = await dicomFileToPng(file);
        // Store as .png in zip (convert base64 to Uint8Array)
        zip.file(
          file.name.replace(/\.dcm$/, ".png"),
          Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))
        );
        setProgress(Math.round(((i + 1) / acceptedFiles.length) * 50)); // 50% for conversion
      }

      setStatus("☁️ Zipping and uploading PNGs to Firebase Storage...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const generatedFilename = `scan_${Date.now()}.zip`;

      // Upload ZIP to Firebase Storage (temp-uploads)
      const zipRef = ref(storage, `temp-uploads/${generatedFilename}`);
      const uploadTask = uploadBytesResumable(zipRef, zipBlob);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent =
              50 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 50);
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
      setStatus(`❌ Upload or conversion failed: ${err.message}`);
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

