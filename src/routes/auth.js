const express = require("express");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { forwardAuthenticated } = require("../middleware/authMiddleware");

const router = express.Router();
const prisma = new PrismaClient();

// Login page
router.get("/login", forwardAuthenticated, (req, res) => {
  res.render("auth/login");
});

// Register page
router.get("/register", forwardAuthenticated, (req, res) => {
  res.render("auth/register");
});

// Handle login
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/auth/login",
  })(req, res, next);
});

// Handle register
router.post("/register", async (req, res) => {
  const { username, password, password2 } = req.body;
  const errors = [];

  // Validation
  if (!username || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" });
  }

  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  }

  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }

  if (errors.length > 0) {
    req.session.errors = errors;
    return res.redirect("/auth/register");
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      errors.push({ msg: "Username is already taken" });
      req.session.errors = errors;
      return res.redirect("/auth/register");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    req.session.success_msg = "You are now registered and can log in";
    res.redirect("/auth/login");
  } catch (err) {
    console.error(err);
    req.session.error_msg = "Error in registration process";
    res.redirect("/auth/register");
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/auth/login");
  });
});

module.exports = router;
