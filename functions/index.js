const { onRequest } = require("firebase-functions/v2/https");
const { onObjectDeleted, onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const admin = require("firebase-admin");
const cors = require("cors")({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // "https://your-production-url.com"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "x-goog-meta-foo"],
  credentials: true
});
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();

// ==== OpenAI API Key Secret ====
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// ==== Auth helper ====
async function authenticateFirebaseToken(req, res) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: "No auth token provided" });
      return null;
    }
    const idToken = match[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    return decodedToken;
  } catch (err) {
    res.status(401).json({ error: "Invalid auth token" });
    return null;
  }
}

// ==== Main AI endpoint ====
exports.analyzeSlices = onRequest(
  { secrets: [OPENAI_API_KEY] },
  async (req, res) => {
    // ---- Handle CORS preflight ----
    if (req.method === "OPTIONS") {
      cors(req, res, () => {
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-goog-meta-foo");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.status(204).send("");
      });
      return;
    }

    cors(req, res, async () => {
      // ---- Auth check ----
      const user = await authenticateFirebaseToken(req, res);
      if (!user) return; // Auth failed

      try {
        const { slices } = req.body;
        if (!slices || slices.length === 0) {
          return res.status(400).json({ error: "No slices provided" });
        }

        // -- Only instantiate OpenAI after checking the secret
        const apiKey = OPENAI_API_KEY.value();
        if (!apiKey) {
          console.error("OPENAI_API_KEY.value() is falsy! (not set, empty, or not injected)");
          return res.status(500).json({ error: "Server misconfiguration: OPENAI_API_KEY is missing" });
        }

        const openai = new OpenAI({
          apiKey,
        });

        const responses = [];
        for (const slice of slices) {
          const imageBase64 = slice.base64;

          const gptRes = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "You are a radiologist AI. Analyze this CT slice and identify any tumors, lesions, or anomalies. Be concise and clinical.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/png;base64,${imageBase64}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0.3,
          });

          const result = gptRes.choices[0].message.content;
          responses.push({
            filename: slice.name,
            result,
          });
        }
        return res.status(200).json({ results: responses });
      } catch (err) {
        console.error("GPT Vision Error:", err);
        return res.status(500).json({ error: err.message || "AI processing error" });
      }
    });
  }
);

// ==== Test endpoint for CORS ====
exports.corsTest = onRequest((req, res) => {
  if (req.method === "OPTIONS") {
    cors(req, res, () => {
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-goog-meta-foo");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.status(204).send("");
    });
    return;
  }
  cors(req, res, () => {
    res.json({ ok: true, origin: req.headers.origin || null });
  });
});

// ==== deleteSliceImage (unchanged) ====
exports.deleteSliceImage = onObjectDeleted(
  { bucket: "vista-lifeimaging-ct-data" },
  async (event) => {
    const filePath = event.data.name;
    console.log(`🗑️ File deleted: ${filePath}`);

    try {
      const db = admin.firestore();
      const scansRef = db.collection("scans");
      const snapshot = await scansRef.where("filePath", "==", filePath).get();

      snapshot.forEach((doc) => {
        console.log(`🔥 Deleting Firestore doc for: ${doc.id}`);
        doc.ref.delete();
      });
    } catch (err) {
      console.error("❌ Firestore cleanup error:", err);
    }
    return null;
  }
);

// ==== analyzeAndAutoDelete: Analyze uploaded ZIP in temp-uploads, then delete ====
exports.analyzeAndAutoDelete = onObjectFinalized(
  { bucket: "vista-lifeimaging-ct-data", region: "us-central1" },
  async (event) => {
    const file = event.data;
    const filePath = file.name;

    // Only process ZIPs in "temp-uploads/"
    if (!filePath.startsWith("temp-uploads/") || !filePath.endsWith(".zip")) {
      console.log("Ignoring file:", filePath);
      return;
    }

    const bucket = admin.storage().bucket(file.bucket);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

    // 1. Download file
    await bucket.file(filePath).download({ destination: tempFilePath });
    console.log(`Downloaded file to ${tempFilePath}`);

    // 2. (TODO) Call your AI analysis here! Replace this dummy function with your real pipeline.
    const analysisResult = await runAIAnalysis(tempFilePath);

    // 3. Save analysis result to Firestore (or wherever you want)
    await admin.firestore().collection("scan-results").add({
      filename: path.basename(filePath),
      result: analysisResult,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Delete file from Storage
    await bucket.file(filePath).delete();
    console.log("Deleted file:", filePath);

    // 5. Clean up temp file
    fs.unlinkSync(tempFilePath);

    return null;
  }
);

// Dummy function. Replace with real AI logic!
async function runAIAnalysis(tempFilePath) {
  // Simulate analysis.
  return { summary: "No abnormal findings." };
}
