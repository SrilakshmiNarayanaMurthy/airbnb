// routes/auth.js
const express = require("express");  //Brings in Express so we can create a router and define endpoints.
const bcrypt = require("bcrypt");    //Used to hash passwords on signup and verify them on login
const { body, validationResult } = require("express-validator");  //Gives you request-body validators (e.g., “email must be valid”) and a way to collect errors.
const { pool } = require("../db");  //Imports a MySQL (or MariaDB) connection pool so you can run pool.query(...)

const router = express.Router(); //Creates a sub-router (mounted later in your app, usually at /api/auth)
const multer = require("multer"); //const multer = require("multer"); const path = require("path");
const path = require("path");

// ---------------- Traveler + Owner Signup ----------------
router.post(
  "/signup",
  body("name").notEmpty().withMessage("name is required"),
  body("email").isEmail().withMessage("valid email required"),
  body("password").isLength({ min: 8 }).withMessage("min 8 chars"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }); //If validation fails, return all errors right away (HTTP 400).
    }
    const { name, email, password } = req.body;
    //Checks for an existing account with the same email. If found, returns 400 { error: "email already in use" }
    try { 
      const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [email]);
      if (rows.length > 0) return res.status(400).json({ error: "email already in use" });

      const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const password_hash = await bcrypt.hash(password, rounds);

      // 🟢 honor frontend role if sent
      const role = req.body.role === "owner" ? "owner" : "user";

      const [result] = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, password_hash, role]
      );

      // 🟢 session reflects true role
      req.session.user = { id: result.insertId, name, email, role };
      res.status(201).json({ id: result.insertId, name, email, role });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "server error" });
    }
  }
);


// ---------------- Login ----------------
// Copies role from DB into the session (critical for owner UI).
router.post(
  "/login",
  body("email").notEmpty().withMessage("email and password required"),
  body("password").notEmpty().withMessage("email and password required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;

    try {
      const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
      if (rows.length === 0) {
        return res.status(400).json({ error: "invalid credentials" });
      }
      const user = rows[0];

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: "invalid credentials" });
      }

      // ⬇️ include role so /api/auth/me returns it to the frontend
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // "owner" or "user"
      };

      res.json({ message: "logged in", user: req.session.user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "server error" });
    }
  }
);

// ---------------- Who am I ----------------
router.get("/me", (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});
//clears the server session and replies LOGGed out
// ---------------- Logout ----------------
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "logged out" });
  });
});

// ---------------- Auth guard ----------------
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "login required" });
  next();
}
//Reads the latest details from DB (not just the session copy)
// ---------------- Profile: GET (fresh from DB) ----------------
router.get("/profile", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, phone, about, city, state, country, languages, gender, avatar_url FROM users WHERE id=?",
    [req.session.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

// ---------------- Profile: UPDATE ----------------
router.put(
  "/profile",
  requireAuth,
  [
    body("name").trim().notEmpty().withMessage("name required"),
    body("email").isEmail().withMessage("valid email required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, phone, about, city, state, country, languages, gender } = req.body;

    // prevent duplicate email (if changing email)
    const [dup] = await pool.query("SELECT id FROM users WHERE email=? AND id<>?", [email, req.session.user.id]);
    if (dup.length) return res.status(409).json({ error: "email already in use" });

    const [r] = await pool.query(
      `UPDATE users SET name=?, email=?, phone=?, about=?, city=?, state=?, country=?, languages=?, gender=? WHERE id=?`,
      [name, email, phone || null, about || null, city || null, state || null, country || null, languages || null, gender || null, req.session.user.id]
    );

    // refresh session copy (keep role untouched)
    req.session.user = { ...req.session.user, name, email };
    res.json({ updated: r.affectedRows === 1 });
  }
);

// ---------------- Avatar upload ----------------
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || ".jpg");
    cb(null, `u${req.session.user.id}-${Date.now()}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG/PNG/WEBP"), ok);
  },
});

router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  const url = `/uploads/${req.file.filename}`;
  await pool.query("UPDATE users SET avatar_url=? WHERE id=?", [url, req.session.user.id]);
  res.json({ avatar_url: url });
});

module.exports = router;
