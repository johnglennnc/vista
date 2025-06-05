const { onRequest } = require("firebase-functions/v2/https");
const { onObjectDeleted, onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const admin = require("firebase-admin");
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
const dicomParser = require("dicom-parser");
const sharp = require("sharp");

admin.initializeApp();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

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

exports.analyzeAndAutoDelete = onObjectFinalized(
  { bucket: "vista-lifeimaging-ct-data", region: "us-central1" },
  async (event) => {
    const file = event.data;
    const filePath = file.name;

    if (!filePath.startsWith("temp-uploads/") || !filePath.endsWith(".zip")) {
      console.log("Ignoring file:", filePath);
      return;
    }

    const bucket = admin.storage().bucket(file.bucket);
    const tempZipPath = path.join(os.tmpdir(), path.basename(filePath));
    await bucket.file(filePath).download({ destination: tempZipPath });
    console.log(`✅ Downloaded ZIP: ${tempZipPath}`);

    const zipBuffer = fs.readFileSync(tempZipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const files = Object.keys(zip.files);
    const results = [];
    const slicePaths = [];

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    const openai = new OpenAI({ apiKey });

    const scanId = path.basename(filePath, ".zip");
    const userId = "unknown"; // Optional: populate later

    for (const filename of files) {
      const fileRef = zip.files[filename];
      if (fileRef.dir || !filename.endsWith(".dcm")) continue;

      try {
        const dicomBuffer = Buffer.from(await fileRef.async("uint8array"));
        const dataSet = dicomParser.parseDicom(dicomBuffer);
        const pixelElement = dataSet.elements.x7fe00010;
        if (!pixelElement) throw new Error("No pixel data");

        const pixelData = new Uint8Array(
          dicomBuffer.buffer,
          pixelElement.dataOffset,
          pixelElement.length
        );

        const width = dataSet.uint16("x00280011");
        const height = dataSet.uint16("x00280010");

        const pngBuffer = await sharp(Buffer.from(pixelData), {
          raw: { width, height, channels: 1 },
        })
          .resize(512, 512)
          .png()
          .toBuffer();

        const sliceFilePath = `users/${userId}/scans/${scanId}/${filename.replace(".dcm", ".png")}`;
        await bucket.file(sliceFilePath).save(pngBuffer, {
          metadata: { contentType: "image/png" },
        });
        slicePaths.push(sliceFilePath);

        const base64Image = pngBuffer.toString("base64");
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
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.3,
        });

        results.push({
          filename,
          result: gptRes.choices[0].message.content,
        });
      } catch (err) {
        console.error(`❌ Error on ${filename}:`, err.message);
        results.push({ filename, result: `Error: ${err.message}` });
      }
    }

    const db = admin.firestore();
    await db.collection("scan-results").add({
      filename: path.basename(filePath),
      results,
      slices: slicePaths,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("scans").add({
      scanId,
      userId,
      slices: slicePaths,
      aiAnalysis: results,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await bucket.file(filePath).delete();
    fs.unlinkSync(tempZipPath);
    console.log("🧹 Cleanup complete");

    return null;
  }
);



