// src/api.js

const API_URL = "https://us-central1-vista-lifeimaging.cloudfunctions.net/analyzeSlices";

// You can add more endpoints if you add more functions later

export async function analyzeSlices(slices, idToken) {
  // slices: Array of { base64: ..., name: ... }
  // idToken: Firebase auth token, if required

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ slices }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API error");
  }
  return response.json();
}
