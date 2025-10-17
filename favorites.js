const express = require("express");
const { pool } = require("../db");
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) return res.status(401).json({ error: "login required" });
  next();
};

// Get favourite IDs for current user -> [1,3,7,...]
router.get("/", requireAuth, async (req, res) => {
  const [rows] = await pool.query("SELECT listing_id FROM favorites WHERE user_id=?", [req.session.user.id]);
  res.json(rows.map(r => r.listing_id));
});

// Toggle favourite (add if missing, remove if already there)
router.post("/:listingId", requireAuth, async (req, res) => {
  const id = Number(req.params.listingId);
  const [ins] = await pool.query("INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)", [req.session.user.id, id]);
  if (ins.affectedRows === 1) return res.json({ ok: true, added: true });
  await pool.query("DELETE FROM favorites WHERE user_id=? AND listing_id=?", [req.session.user.id, id]);
  res.json({ ok: true, removed: true });
});

module.exports = router;
