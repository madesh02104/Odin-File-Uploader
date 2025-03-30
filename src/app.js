const express = require("express");
const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const path = require("path");
const ejsLayouts = require("express-ejs-layouts");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const dotenv = require("dotenv");
const { getFileTypeClass } = require("./utils/helpers");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client
const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../public")));

// Configure view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(ejsLayouts);
app.set("layout", "layouts/main");

// Session configuration
app.use(
  session({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // ms
    },
    secret: "your-secret-key",
    resave: true,
    saveUninitialized: true,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Import and configure passport
require("./config/passportConfig")(passport);

// Global variables for templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.session.success_msg || "";
  res.locals.error_msg = req.session.error_msg || "";
  res.locals.errors = req.session.errors || [];
  res.locals.getFileTypeClass = getFileTypeClass; // Make the helper function available to all templates

  // Clear flash messages
  if (req.session.success_msg) req.session.success_msg = "";
  if (req.session.error_msg) req.session.error_msg = "";
  if (req.session.errors) req.session.errors = [];

  next();
});

// Import routes
const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const folderRoutes = require("./routes/folders");
const { ensureAuthenticated } = require("./middleware/authMiddleware");

// Use routes
app.use("/auth", authRoutes);
app.use("/files", ensureAuthenticated, fileRoutes);
app.use("/folders", ensureAuthenticated, folderRoutes);

// Dashboard route
app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const filesCount = await prisma.file.count({
      where: { userId: req.user.id },
    });

    const foldersCount = await prisma.folder.count({
      where: { userId: req.user.id },
    });

    const recentFiles = await prisma.file.findMany({
      where: { userId: req.user.id },
      include: { folder: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.render("dashboard", {
      filesCount,
      foldersCount,
      recentFiles,
    });
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error loading dashboard";
    res.redirect("/auth/login");
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", {
    message: "Page not found",
    error: { status: 404 },
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
