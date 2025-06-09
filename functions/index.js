const { onRequest } = require("firebase-functions/v2/https");
const { onObjectDeleted, onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const cors = require("cors")({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://vista-theta.vercel.app"],
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
      const bucket = admin.storage().bucket("vista-lifeimaging-ct-data");

      for (const slice of slices) {
        const storagePath = slice.url;
        try {
          const file = bucket.file(storagePath);
          const [contents] = await file.download();
          // Convert DICOM to PNG
          const dataSet = dicomParser.parseDicom(contents);
          const pixelData = dataSet.elements.x7fe00010;
          if (!pixelData) {
            throw new Error(`No pixel data in DICOM: ${storagePath}`);
          }
          const pixelBuffer = Buffer.from(dataSet.byteArray.buffer, pixelData.dataOffset, pixelData.length);
          const image = await sharp(pixelBuffer, {
            raw: {
              width: dataSet.uint16('x00280011'), // Columns
              height: dataSet.uint16('x00280010'), // Rows
              channels: 1,
              depth: 'uint16',
            },
          })
            .normalize()
            .png()
            .toBuffer();
          const imageBase64 = image.toString('base64');

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
        } catch (err) {
          console.error(`Error processing slice ${storagePath}:`, err);
          responses.push({
            filename: slice.name,
            result: `Error: ${err.message || "Processing error"}`,
          });
        }
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
  async (cloudEvent) => {
    const storageObject = cloudEvent.data;
    if (!storageObject || !storageObject.name || !storageObject.name.startsWith("slices/")) {
      console.log("Ignoring non-slice file deletion:", storageObject ? storageObject.name : cloudEvent);
      return null;
    }
    console.log(`🗑️ File deleted: ${storageObject.name}`);
    try {
      const db = admin.firestore();
      const scansRef = db.collection("scans");
      const snapshot = await scansRef.where("slices", "array-contains", storageObject.name).get();
      for (const doc of snapshot.docs) {
        const scanData = doc.data();
        if (scanData.status === "pending" || scanData.status === "processed") {
          console.log(`Skipping cleanup for scan ${doc.id} with status ${scanData.status}`);
          continue;
        }
        const remainingSlices = scanData.slices.filter(slice => slice !== storageObject.name);
        if (remainingSlices.length > 0) {
          await doc.ref.update({ slices: remainingSlices });
          console.log(`Updated scan ${doc.id} with remaining slices`);
        } else {
          await doc.ref.delete();
          console.log(`🔥 Deleted Firestore doc: ${doc.id}`);
        }
      }
    } catch (err) {
      console.error("❌ Firestore cleanup error:", err);
    }
    return null;
  }
);

exports.processUploadedScan = onObjectFinalized(
  { bucket: "vista-lifeimaging-ct-data" },
  async (cloudEvent) => {
    console.log("processUploadedScan triggered with event:", JSON.stringify(cloudEvent));
    const storageObject = cloudEvent.data;
    if (!storageObject || !storageObject.name) {
      console.log("Invalid storage object:", cloudEvent);
      return null;
    }
    if (!storageObject.name.startsWith("temp-uploads/") || !storageObject.name.endsWith(".zip")) {
      console.log("Ignoring non-ZIP or non-temp-uploads file:", storageObject.name);
      return null;
    }
    console.log("Processing valid file:", storageObject.name);
    const bucket = admin.storage().bucket(storageObject.bucket);
    const tempZipPath = path.join(os.tmpdir(), path.basename(storageObject.name));
    await bucket.file(storageObject.name).download({ destination: tempZipPath });
    console.log(`✅ Downloaded ZIP: ${tempZipPath}`);
    let userId = "unknown";
    try {
      const [fileMetadata] = await bucket.file(storageObject.name).getMetadata();
      userId = fileMetadata.metadata && fileMetadata.metadata.userId ? fileMetadata.metadata.userId : "unknown";
    } catch (err) {
      console.warn("No userId metadata found, defaulting to 'unknown'");
    }
    const zipBuffer = fs.readFileSync(tempZipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const slicePaths = [];
    const scanId = path.basename(storageObject.name, ".zip");
    await Promise.all(
      Object.keys(zip.files).map(async (filename) => {
        const fileRef = zip.files[filename];
        if (fileRef.dir) return;
        const content = await fileRef.async("nodebuffer");
        const uploadPath = `slices/${scanId}/${filename}`;
        await bucket.file(uploadPath).save(content);
        slicePaths.push(uploadPath);
      })
    );
    const db = admin.firestore();
    await db.collection("scans").add({
      scanId,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      slices: slicePaths,
    });
    // Comment out deletion to keep ZIP for now
    // await bucket.file(storageObject.name).delete();
    fs.unlinkSync(tempZipPath);
    console.log("🧹 Cleanup complete, ZIP retained in temp-uploads/");
    return null;
  }
);

exports.autoAnalyzeScan = onDocumentCreated(
  { document: "scans/{scanId}", secrets: [OPENAI_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No snapshot data");
      return null;
    }
    const data = snap.data();
    const { slices = [], scanId } = data;

    if (!slices.length) {
      console.log("No slices to analyze for scanId:", scanId);
      return null;
    }

    const bucket = admin.storage().bucket("vista-lifeimaging-ct-data");
    const sliceFiles = [];

    for (const storagePath of slices) {
      try {
        const file = bucket.file(storagePath);
        const [contents] = await file.download();
        const dataSet = dicomParser.parseDicom(contents);
        const pixelData = dataSet.elements.x7fe00010;
        if (!pixelData) {
          console.error(`No pixel data in DICOM: ${storagePath}`);
          continue;
        }
        const pixelBuffer = Buffer.from(dataSet.byteArray.buffer, pixelData.dataOffset, pixelData.length);
        const image = await sharp(pixelBuffer, {
          raw: {
            width: dataSet.uint16('x00280011'),
            height: dataSet.uint16('x00280010'),
            channels: 1,
            depth: 'uint16',
          },
        })
          .normalize()
          .png()
          .toBuffer();
        const base64 = image.toString('base64');
        sliceFiles.push({ name: storagePath.split('/').pop(), base64 });
      } catch (err) {
        console.error(`Error processing DICOM ${storagePath}:`, err);
        continue;
      }
    }

    if (!sliceFiles.length) {
      console.log("No valid slices processed for scanId:", scanId);
      return null;
    }

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      console.error("No OpenAI API Key available for scanId:", scanId);
      return null;
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
        console.error(`Error analyzing slice ${slice.name}:`, err);
        responses.push({
          filename: slice.name,
          result: "Error: " + (err.message || "AI processing error"),
        });
      }
    }

    try {
      await admin.firestore().collection("scan-results").add({
        scanId,
        filename: scanId,
        results: responses,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await event.data.ref.update({ status: "processed" });
      console.log("✅ Analysis complete and results saved for scanId:", scanId);
    } catch (err) {
      console.error("Error saving results or updating status for scanId:", scanId, err);
    }

    return null;
  }
);