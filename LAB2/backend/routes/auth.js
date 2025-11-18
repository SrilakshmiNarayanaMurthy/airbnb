// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const User = require("../models/User");

// --- common helper used by both /register and /signup -------------
async function handleSignup(req, res) {
  try {
    const {
      name,
      email,
      password,
      role = "traveler",
      city,
      state,
      country,
      phone,
      about,
      languages,
      gender,
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      city,
      state,
      country,
      phone,
      about,
      // if languages comes in as "English, Hindi" string:
      languages:
        typeof languages === "string"
          ? languages.split(",").map((s) => s.trim())
          : languages,
      gender,
    });

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      city: user.city,
      state: user.state,
      country: user.country,
    });
  } catch (e) {
    console.error("Signup error:", e);
    return res.status(500).json({ error: "server error" });
  }
}


// --- register (used by Lab1/Postman) -------------------------------
router.post("/register", handleSignup);

// --- signup (used by your new frontend) ---------------------------
router.post("/signup", handleSignup);

// --- login ---------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// --- current user --------------------------------------------------
router.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "not logged in" });
  }
  res.json(req.session.user);
});

// *******************************************************************
//   ⭐ NEW: FULL PROFILE FETCH (used in Profile.jsx useEffect)
// *******************************************************************
router.get("/profile", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "not logged in" });
    }

    const user = await User.findById(req.session.user.id).lean();
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    res.json(user);
  } catch (e) {
    console.error("GET /api/auth/profile error:", e);
    res.status(500).json({ error: "server error" });
  }
});


// *******************************************************************
//   ⭐ NEW: FULL PROFILE UPDATE (PUT) — saves to Mongo
// *******************************************************************

// ---------- PROFILE (used by Profile.jsx) -----------------
// GET profile
router.get("/profile", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "not logged in" });
    }

    const user = await User.findById(req.session.user.id).lean();
    if (!user) return res.status(404).json({ error: "user not found" });

    // Convert languages array -> comma-separated string for UI
    const result = {
      ...user,
      languages: Array.isArray(user.languages)
        ? user.languages.join(", ")
        : user.languages || "",
    };

    res.json(result);
  } catch (e) {
    console.error("GET /api/auth/profile error:", e);
    res.status(500).json({ error: "server error" });
  }
});


// PUT profile
router.put("/profile", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "not logged in" });
    }

    const allowed = [
      "name",
      "email",
      "phone",
      "about",
      "city",
      "country",
      "state",
      "languages",
      "gender",
    ];

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        if (key === "languages" && typeof req.body[key] === "string") {
          updates.languages = req.body[key]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.session.user.id,
      updates,
      { new: true }
    ).lean();

    const result = {
      ...user,
      languages: Array.isArray(user.languages)
        ? user.languages.join(", ")
        : user.languages || "",
    };

    res.json(result);
  } catch (e) {
    console.error("PUT /api/auth/profile error:", e);
    res.status(500).json({ error: "server error" });
  }
});


// --- logout ---------------------------------------------------------
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ---------- AVATAR UPLOAD (used by Profile.jsx) ------------
// store files in backend/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = `avatar_${Date.now()}`;
    cb(null, base + ext);
  },
});

const upload = multer({ storage });

router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "not logged in" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "no file uploaded" });
    }

    const avatarPath = `/uploads/${req.file.filename}`;

    await User.findByIdAndUpdate(req.session.user.id, {
      avatar_url: avatarPath,
    });

    res.json({ avatar_url: avatarPath });
  } catch (e) {
    console.error("POST /api/auth/avatar error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
