require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir, {
  setHeaders(res) { res.setHeader("X-Content-Type-Options", "nosniff"); }
}));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campus_lost_found",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const allowedCategories = ["ID Card", "Wallet", "Books", "Electronics", "Keys", "Clothing", "Bag", "Other"];
const allowedTypes = ["LOST", "FOUND"];
const allowedStatuses = ["OPEN", "CLAIMED", "RESOLVED"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  }
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const valid = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(valid ? null : new Error("Only JPG, PNG, WEBP or GIF images are allowed."), valid);
  }
});

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function deleteUploaded(file) {
  if (file?.path) fs.unlink(file.path, () => {});
}
function publicItem(row) {
  return {
    ...row,
    image_url: row.image_filename ? `/uploads/${encodeURIComponent(row.image_filename)}` : null,
    item_date: row.item_date ? new Date(row.item_date).toISOString().slice(0, 10) : null,
    created_at: row.created_at
  };
}


app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(503).json({
      ok: false,
      database: "unavailable",
      error: err.code || err.message
    });
  }
});


app.get("/api/items", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    const type = cleanText(req.query.type, 10).toUpperCase();
    const category = cleanText(req.query.category, 30);
    const status = cleanText(req.query.status, 20).toUpperCase();
    const search = cleanText(req.query.search, 100);

    if (type && allowedTypes.includes(type)) { where.push("report_type = ?"); params.push(type); }
    if (category && allowedCategories.includes(category)) { where.push("category = ?"); params.push(category); }
    if (status && allowedStatuses.includes(status)) { where.push("status = ?"); params.push(status); }
    if (search) {
      where.push("(item_name LIKE ? OR description LIKE ? OR location LIKE ? OR category LIKE ?)");
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const sql = `SELECT id, report_type, item_name, category, description, location,
      item_date, contact_name, contact_email, contact_phone, image_filename,
      status, created_at FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC LIMIT 200`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(publicItem));
  } catch (err) { next(err); }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    const [rows] = await pool.execute(
      `SELECT id, report_type, item_name, category, description, location, item_date,
       contact_name, contact_email, contact_phone, image_filename, status, created_at
       FROM items WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Item not found." });
    res.json(publicItem(rows[0]));
  } catch (err) { next(err); }
});

app.post("/api/items", (req, res, next) => {
  imageUpload.single("image")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    try {
      const body = req.body || {};
      const reportType = cleanText(body.report_type, 10).toUpperCase();
      const itemName = cleanText(body.item_name, 120);
      const category = cleanText(body.category, 30);
      const description = cleanText(body.description, 3000);
      const location = cleanText(body.location, 180);
      const itemDate = cleanText(body.item_date, 10);
      const contactName = cleanText(body.contact_name, 100);
      const contactEmail = cleanText(body.contact_email, 190).toLowerCase();
      const contactPhone = cleanText(body.contact_phone, 30);

      if (!allowedTypes.includes(reportType)) { deleteUploaded(req.file); return res.status(400).json({ error: "Choose Lost or Found." }); }
      if (!itemName || !description || !location || !contactName || !contactEmail) {
        deleteUploaded(req.file); return res.status(400).json({ error: "Please complete all required fields." });
      }
      if (!allowedCategories.includes(category)) { deleteUploaded(req.file); return res.status(400).json({ error: "Choose a valid category." }); }
      if (!validEmail(contactEmail)) { deleteUploaded(req.file); return res.status(400).json({ error: "Enter a valid email address." }); }
      if (itemDate && !/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) {
        deleteUploaded(req.file); return res.status(400).json({ error: "Use a valid item date." });
      }

      const [result] = await pool.execute(
        `INSERT INTO items
        (report_type, item_name, category, description, location, item_date,
         contact_name, contact_email, contact_phone, image_filename)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportType, itemName, category, description, location, itemDate || null,
         contactName, contactEmail, contactPhone || null, req.file?.filename || null]
      );
      const [rows] = await pool.execute(
        `SELECT id, report_type, item_name, category, description, location, item_date,
         contact_name, contact_email, contact_phone, image_filename, status, created_at
         FROM items WHERE id = ?`, [result.insertId]);
      res.status(201).json(publicItem(rows[0]));
    } catch (err) { deleteUploaded(req.file); next(err); }
  });
});

app.patch("/api/items/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = cleanText(req.body?.status, 20).toUpperCase();
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });
    const [result] = await pool.execute("UPDATE items SET status = ? WHERE id = ?", [status, id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Item not found." });
    res.json({ message: "Status updated.", id, status });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Campus Lost & Found running at http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
