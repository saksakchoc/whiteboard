const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const rootDir = path.join(__dirname, "..");
const dbPath = process.env.DB_PATH || path.join(rootDir, "data", "whiteboard.db");
const uploadsDir = process.env.UPLOADS_DIR || path.join(rootDir, "uploads");

function safeFilePart(value, fallback = "file") {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || fallback;
}

function dataUrlExtension(mime) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "png";
}

const db = new Database(dbPath);
const rows = db
  .prepare(
    "SELECT id, board_id, src FROM images_v2 WHERE substr(src, 1, 5) = 'data:'"
  )
  .all();

const update = db.prepare("UPDATE images_v2 SET src = ? WHERE id = ?");
let converted = 0;
let skipped = 0;

const convertAll = db.transaction(() => {
  for (const row of rows) {
    const match = row.src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      skipped += 1;
      continue;
    }

    const boardPart = safeFilePart(row.board_id, "board");
    const boardDir = path.join(uploadsDir, boardPart);
    fs.mkdirSync(boardDir, { recursive: true });

    const ext = dataUrlExtension(match[1].toLowerCase());
    const filename = `${safeFilePart(row.id, `image_${Date.now()}`)}.${ext}`;
    fs.writeFileSync(path.join(boardDir, filename), Buffer.from(match[2], "base64"));
    update.run(`/uploads/${boardPart}/${filename}`, row.id);
    converted += 1;
  }
});

convertAll();

console.log(JSON.stringify({ converted, skipped, remaining: rows.length - converted - skipped }));
