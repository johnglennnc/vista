import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase/config";

function UploadTest() {
  const [status, setStatus] = useState("Idle");

  const onDrop = async (acceptedFiles) => {
    setStatus("Uploading...");
    try {
      const file = acceptedFiles[0];
      const fileRef = ref(storage, `test/${file.name}`);
      await uploadBytes(fileRef, file);
      setStatus("✅ Upload successful!");
    } catch (err) {
      setStatus("❌ Upload failed.");
      console.error("Firebase Storage Upload Error:", err);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: false });

  return (
    <div>
      <div {...getRootProps()} style={{ border: "1px solid gray", padding: 20 }}>
        <input {...getInputProps()} />
        <p>Drop a PNG file here</p>
      </div>
      <div>{status}</div>
    </div>
  );
}

export default UploadTest;
