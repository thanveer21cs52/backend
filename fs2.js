import { neon } from "@neondatabase/serverless";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = neon(process.env.db_url);

// ✅ Use persistent storage path (Render Disk)
const UPLOADS_DIR = "/opt/data/uploads";

// ✅ Ensure folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000", // Make it dynamic
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Upload file
app.post("/upload", upload.single("myfile"), async (req, res) => {
  try {
    await client`
      INSERT INTO filedetails (filename, filepath, description)
      VALUES (${req.file.filename}, ${path.join(UPLOADS_DIR, req.file.filename)}, ${req.body.description})
    `;
    res.json({ message: "success", description: "File uploaded!" });
  } catch (err) {
    console.error("Insert Error:", err);
    res.status(500).json({ message: "error", description: "DB insert failed" });
  }
});

// Get all files
app.get("/files", async (req, res) => {
  try {
    const data = await client`SELECT * FROM filedetails`;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "error", description: "Could not fetch files" });
  }
});

// Download file
app.get("/download/:filename", (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  res.download(filepath, req.params.filename, (err) => {
    if (err) res.status(500).send("File not found");
  });
});

// Delete file
app.delete("/delete/:filename", async (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  try {
    try {
      fs.unlinkSync(filepath);
    } catch {
      console.warn("File not found on disk:", req.params.filename);
    }

    await client`DELETE FROM filedetails WHERE filename = ${req.params.filename}`;
    res.json({ message: "success", description: "file deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "error", description: "Could not delete file" });
  }
});

// Rename file
app.put("/rename/:filename/:newname/:description", async (req, res) => {
  const oldpath = path.join(UPLOADS_DIR, req.params.filename);
  const newpath = path.join(UPLOADS_DIR, req.params.newname);
  try {
    try {
      fs.renameSync(oldpath, newpath);
    } catch {
      console.warn("File not found on disk:", req.params.filename);
    }

    await client`
      UPDATE filedetails
      SET filename = ${req.params.newname}, description = ${req.params.description}
      WHERE filename = ${req.params.filename}
    `;
    res.json({ message: "success", description: "file renamed successfully" });
  } catch (err) {
    res.status(500).json({ message: "error", description: "Could not rename file" });
  }
});

// ✅ Important for Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;
