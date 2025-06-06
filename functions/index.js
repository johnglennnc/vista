const { onRequest } = require("firebase-functions/v2/https");
const { onObjectDeleted, onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");  // <--- ADD THIS LINE
const admin = require("firebase-admin");
admin.initializeApp();
const cors = require("cors")({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "x-goog-meta-foo"],
  credentials: true,
});
const path = require("path");
const os = require("os");
const fs = require("fs");
const JSZip = require("jszip");
const { Storage } = require("@google-cloud/storage");
const OpenAI = require("openai");
const dicomParser = require("dicom-parser");
const sharp = require("sharp");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Your helpers and function exports go below here
exports.hello = onRequest(async (req, res) => {
  res.json({ ok: true });
});
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
exports.analyzeSlices = onRequest({ secrets: [OPENAI_API_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(req, res, () => {
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-goog-meta-foo");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.status(204).send("");
    });
    return;
  }

  cors(req, res, async () => {
    const user = await authenticateFirebaseToken(req, res);
    if (!user) return;

    try {
      const { slices } = req.body;
      if (!slices || slices.length === 0) {
        return res.status(400).json({ error: "No slices provided" });
      }

      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not available" });

      const openai = new OpenAI({ apiKey });
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

        responses.push({
          filename: slice.name,
          result: gptRes.choices[0].message.content,
        });
      }

      return res.status(200).json({ results: responses });
    } catch (err) {
      console.error("GPT Vision Error:", err);
      return res.status(500).json({ error: err.message || "AI processing error" });
    }
  });
});
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
exports.processUploadedScan = onObjectFinalized(
  { bucket: "vista-lifeimaging-ct-data" },
  async (object) => {
    if (!object.name.startsWith("temp-uploads/") || !object.name.endsWith(".zip")) {
      console.log("Ignoring file:", object.name);
      return;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const tempZipPath = path.join(os.tmpdir(), path.basename(object.name));
    await bucket.file(object.name).download({ destination: tempZipPath });
    console.log(`✅ Downloaded ZIP: ${tempZipPath}`);

    // Get userId from metadata if present
    let userId = "unknown";
    try {
      const [fileMetadata] = await bucket.file(object.name).getMetadata();
      userId = fileMetadata.metadata && fileMetadata.metadata.userId ? fileMetadata.metadata.userId : "unknown";
    } catch (err) {
      console.warn("No userId metadata found, defaulting to 'unknown'");
    }

    const zipBuffer = fs.readFileSync(tempZipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const slicePaths = [];

    const scanId = path.basename(object.name, ".zip");

    // Unzip DICOMs and upload to /slices/{scanId}/
    await Promise.all(
      Object.keys(zip.files).map(async (filename) => {
        const fileRef = zip.files[filename];
        if (fileRef.dir) return; // Skip directories
        // You can optionally validate file type here (.dcm)
        const content = await fileRef.async("nodebuffer");
        const uploadPath = `slices/${scanId}/${filename}`;
        await bucket.file(uploadPath).save(content);
        slicePaths.push(uploadPath);
      })
    );

    // Create a Firestore scan record so it shows up in your frontend!
    const db = admin.firestore();
    await db.collection("scans").add({
      scanId,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      slices: slicePaths,
    });

    // Delete the uploaded ZIP (cleanup)
    await bucket.file(object.name).delete();
    fs.unlinkSync(tempZipPath);
    console.log("🧹 Cleanup complete for ZIP and temp file");

    return null;
  }
);

// --------- ADD THIS SECTION TO THE BOTTOM ---------
// Auto-analyze every new scan
exports.autoAnalyzeScan = onDocumentCreated("scans/{scanId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const { slices = [], scanId } = data;

  if (!slices.length) {
    console.log("No slices to analyze");
    return;
  }

  // Download all slices from storage and convert to base64
  const bucket = admin.storage().bucket();
  const sliceFiles = [];

  for (const storagePath of slices) {
    const file = bucket.file(storagePath);
    const [contents] = await file.download();
    const base64 = contents.toString('base64');
    sliceFiles.push({ name: storagePath.split('/').pop(), base64 });
  }

  // Call OpenAI Vision API for each slice
  const apiKey = process.env.OPENAI_API_KEY || (OPENAI_API_KEY ? OPENAI_API_KEY.value() : null);
  if (!apiKey) {
    console.error("No OpenAI API Key available.");
    return;
  }
  const openai = new OpenAI({ apiKey });

  const responses = [];
  for (const slice of sliceFiles) {
    try {
      const gptRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a radiologist AI. Analyze this CT slice and identify any tumors, lesions, or anomalies. Be concise and clinical.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${slice.base64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
      });
      responses.push({
        filename: slice.name,
        result: gptRes.choices[0].message.content,
      });
    } catch (err) {
      responses.push({
        filename: slice.name,
        result: "Error: " + (err.message || "AI processing error"),
      });
    }
  }

  // Write results to scan-results
  await admin.firestore().collection("scan-results").add({
    scanId,
    filename: scanId,
    results: responses,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Analysis complete and results saved for scanId:", scanId);
});

