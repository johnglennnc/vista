// src/components/Upload.js

import React, { useState } from "react";
import { analyzeSlices } from "../api"; // Path correct

function Upload() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Convert File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]); // just base64, not the whole data url
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Handle file input change
  async function handleFileChange(event) {
    setResults(null);
    setError("");
    setFiles(Array.from(event.target.files));
  }

  // Analyze uploaded files
  async function handleAnalyze() {
    setError("");
    setResults(null);
    setLoading(true);
    try {
      // Convert each file to { base64, name }
      const slices = await Promise.all(
        files.map(async (file) => ({
          base64: await fileToBase64(file),
          name: file.name,
        }))
      );
      // TODO: If you need auth, get idToken here
      const res = await analyzeSlices(slices /*, idToken */);
      setResults(res.results);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      <h2>Upload CT Slices</h2>
      <input
        type="file"
        accept="image/png,image/jpeg"
        multiple
        onChange={handleFileChange}
        style={{ marginBottom: 12 }}
      />
      {files.length > 0 && (
        <div>
          <p>{files.length} file(s) selected:</p>
          <ul>
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
          <button onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      )}
      {error && <div style={{ color: "red", marginTop: 16 }}>{error}</div>}
      {results && (
        <div style={{ marginTop: 24 }}>
          <h4>Results:</h4>
          <pre>{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default Upload;
