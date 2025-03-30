const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
require("dotenv").config();

const router = express.Router();
const prisma = new PrismaClient();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer (Memory Storage for Buffer Upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Unauthorized. Please log in." });
}

// Render Upload Page
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
    });
    res.render("upload", { title: "Upload File", folders });
  } catch (err) {
    res.status(500).json({ error: "Failed to load upload page" });
  }
});

// Upload File to Cloudinary
router.post("/", isAuthenticated, upload.single("file"), async (req, res) => {
  console.log("Uploading file to Cloudinary...");

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "uploads" }, // Optional: Store in a folder
      async (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error: "Cloudinary upload failed" });
        }

        const fileData = {
          name: req.file.originalname,
          url: result.secure_url,
          userId: req.user.id,
          folderId: req.body.folderId || null,
        };

        const file = await prisma.file.create({ data: fileData });

        res.json(file);
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (err) {
    res.status(500).json({ error: "File upload failed" });
  }
});

module.exports = router;
