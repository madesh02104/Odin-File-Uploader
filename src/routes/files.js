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
  if (!req.file) {
    req.session.error_msg = "Please select a file to upload";
    return res.redirect("/files/upload");
  }

  try {
    // Upload to Cloudinary
    let uploadResult;
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "odin-file-uploader" },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    uploadResult = await streamUpload(req.file.buffer);

    // Save file record to database
    await prisma.file.create({
      data: {
        name: req.file.originalname,
        url: uploadResult.secure_url,
        userId: req.user.id,
        folderId: req.body.folderId || null,
      },
    });

    req.session.success_msg = "File uploaded successfully";
    res.redirect("/files");
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error uploading file";
    res.redirect("/files/upload");
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
