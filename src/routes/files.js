const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Get all files
router.get("/", async (req, res) => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user.id },
      include: { folder: true },
      orderBy: { createdAt: "desc" },
    });

    res.render("files/index", { files });
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error loading files";
    res.redirect("/");
  }
});

// Upload file form
router.get("/upload", async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
    });

    res.render("files/upload", {
      folders,
      selectedFolder: req.query.folderId || "",
    });
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error loading upload form";
    res.redirect("/files");
  }
});

// Upload file
router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("POST request received at /files/upload");

  if (!req.file) {
    console.error("No file received in the request");
    req.session.error_msg = "Please select a file to upload";
    return res.redirect("/files/upload");
  }

  try {
    console.log(
      `Uploading file: ${req.file.originalname}, size: ${req.file.size} bytes`
    );

    // Upload to Cloudinary
    let uploadResult;
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        console.log("Starting Cloudinary upload...");
        const stream = cloudinary.uploader.upload_stream(
          { folder: "odin-file-uploader" },
          (error, result) => {
            if (result) {
              console.log(`Cloudinary upload successful: ${result.secure_url}`);
              resolve(result);
            } else {
              console.error("Cloudinary upload error:", error);
              reject(error);
            }
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    uploadResult = await streamUpload(req.file.buffer);
    console.log("File uploaded to Cloudinary successfully");

    // Save file record to database
    const fileRecord = await prisma.file.create({
      data: {
        name: req.file.originalname,
        url: uploadResult.secure_url,
        userId: req.user.id,
        folderId: req.body.folderId || null,
      },
    });
    console.log(`File record created in database with ID: ${fileRecord.id}`);

    req.session.success_msg = "File uploaded successfully";
    return res.redirect("/files");
  } catch (err) {
    console.error("Error during file upload:", err);
    req.session.error_msg = `Error uploading file: ${
      err.message || "Unknown error"
    }`;
    return res.redirect("/files/upload");
  }
});

// Delete file
router.get("/:id/delete", async (req, res) => {
  try {
    // Check if file exists and belongs to user
    const file = await prisma.file.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!file) {
      req.session.error_msg = "File not found or access denied";
      return res.redirect("/files");
    }

    // Extract public_id from URL (based on your Cloudinary setup)
    const urlParts = file.url.split("/");
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const fileName = fileNameWithExtension.split(".")[0];
    const publicId = `odin-file-uploader/${fileName}`;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.id },
    });

    req.session.success_msg = "File deleted successfully";
    res.redirect("/files");
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error deleting file";
    res.redirect("/files");
  }
});

module.exports = router;
