const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cloudinary = require("cloudinary").v2;

const router = express.Router();
const prisma = new PrismaClient();

// Get all folders
router.get("/", async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
      include: { files: true },
      orderBy: { createdAt: "desc" },
    });

    res.render("folders/index", { folders });
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error loading folders";
    res.redirect("/");
  }
});

// Create folder form
router.get("/new", (req, res) => {
  res.render("folders/new");
});

// Create folder
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    req.session.error_msg = "Folder name is required";
    return res.redirect("/folders/new");
  }

  try {
    await prisma.folder.create({
      data: {
        name,
        userId: req.user.id,
      },
    });

    req.session.success_msg = "Folder created successfully";
    res.redirect("/folders");
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error creating folder";
    res.redirect("/folders/new");
  }
});

// View single folder
router.get("/:id", async (req, res) => {
  try {
    const folder = await prisma.folder.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: { files: true },
    });

    if (!folder) {
      req.session.error_msg = "Folder not found or access denied";
      return res.redirect("/folders");
    }

    res.render("folders/show", { folder });
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error loading folder";
    res.redirect("/folders");
  }
});

// Delete folder
router.get("/:id/delete", async (req, res) => {
  try {
    // Check if folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: { files: true },
    });

    if (!folder) {
      req.session.error_msg = "Folder not found or access denied";
      return res.redirect("/folders");
    }

    // Delete files from Cloudinary
    for (const file of folder.files) {
      const urlParts = file.url.split("/");
      const fileNameWithExtension = urlParts[urlParts.length - 1];
      const fileName = fileNameWithExtension.split(".")[0];
      const publicId = `odin-file-uploader/${fileName}`;

      await cloudinary.uploader.destroy(publicId);
    }

    // Delete folder (this will cascade delete the files)
    await prisma.folder.delete({
      where: { id: req.params.id },
    });

    req.session.success_msg = "Folder deleted successfully";
    res.redirect("/folders");
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error deleting folder";
    res.redirect("/folders");
  }
});

module.exports = router;
