// db.js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// DBファイル保存ディレクトリ
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, "whiteboard.db");
const db = new Database(dbPath);

// --- スキーマ初期化 ---
db.exec(`
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS board_meta (
  board_id TEXT PRIMARY KEY,
  title TEXT
);

CREATE TABLE IF NOT EXISTS strokes_v2 (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user TEXT,
  color TEXT NOT NULL,
  size INTEGER NOT NULL,
  points TEXT NOT NULL,
  layer TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  fill INTEGER NOT NULL DEFAULT 0,
  group_id TEXT,
  fill_source_id TEXT
);

CREATE TABLE IF NOT EXISTS texts_v2 (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user TEXT,
  lines TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  font_size REAL NOT NULL,
  color TEXT NOT NULL,
  layer TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  label TEXT,
  rotation REAL NOT NULL DEFAULT 0,
  vertical INTEGER NOT NULL DEFAULT 0,
  grid_text INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS images_v2 (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user TEXT,
  src TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  layer TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  tag_type TEXT,
  tag_label TEXT,
  image_name TEXT,
  image_list_order REAL
);

CREATE TABLE IF NOT EXISTS draft_strokes (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user TEXT NOT NULL,
  color TEXT NOT NULL,
  size INTEGER NOT NULL,
  points TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  fill INTEGER NOT NULL DEFAULT 0,
  group_id TEXT
);

CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  favorite_color TEXT
);

CREATE TABLE IF NOT EXISTS board_users (
  board_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  PRIMARY KEY (board_id, user_name),
  FOREIGN KEY (user_name) REFERENCES users(name) ON DELETE CASCADE
);
`);

// 既存テーブルへの列追加（存在しない場合だけ）
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN label TEXT");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE strokes_v2 ADD COLUMN layer TEXT NOT NULL DEFAULT 'user'");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN layer TEXT NOT NULL DEFAULT 'user'");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN rotation REAL NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN vertical INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN grid_text INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN rotation REAL NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE strokes_v2 ADD COLUMN fill INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE strokes_v2 ADD COLUMN group_id TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE draft_strokes ADD COLUMN fill INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE draft_strokes ADD COLUMN group_id TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE draft_strokes ADD COLUMN fill_source_id TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN tag_type TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN tag_label TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN image_name TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN image_list_order REAL");
} catch (e) {
  // ignore
}

// --- boards ---
function createBoard(id) {
  const stmt = db.prepare(
    "INSERT INTO boards (id, created_at) VALUES (?, ?)"
  );
  stmt.run(id, Date.now());
}

function getBoard(id) {
  const stmt = db.prepare("SELECT * FROM boards WHERE id = ?");
  return stmt.get(id);
}

function getBoardTitle(boardId) {
  const stmt = db.prepare("SELECT title FROM board_meta WHERE board_id = ?");
  const row = stmt.get(boardId);
  return row ? row.title : null;
}

function addUser(name, favoriteColor = null) {
  if (!name) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (name, favorite_color)
    VALUES (?, ?)
  `);
  stmt.run(name, favoriteColor || null);
}

function linkUserToBoard(boardId, name) {
  if (!boardId || !name) return;
  addUser(name);
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO board_users (board_id, user_name)
    VALUES (?, ?)
  `);
  stmt.run(boardId, name);
}

function getBoardUsers(boardId) {
  if (!boardId) return [];
  const stmt = db.prepare(`
    SELECT user_name FROM board_users
    WHERE board_id = ?
    ORDER BY user_name ASC
  `);
  return stmt.all(boardId).map((row) => row.user_name);
}

function setBoardTitle(boardId, title) {
  const stmt = db.prepare(`
    INSERT INTO board_meta (board_id, title)
    VALUES (?, ?)
    ON CONFLICT(board_id) DO UPDATE SET title=excluded.title
  `);
  stmt.run(boardId, title);
}

// --- strokes_v2 ---
function saveStroke(stroke) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO strokes_v2 (id, board_id, user, color, size, points, layer, "order", created_at, fill, group_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    stroke.id,
    stroke.board_id,
    stroke.user || null,
    stroke.color,
    stroke.size,
    JSON.stringify(stroke.points),
    stroke.layer || "user",
    stroke.order || 0,
    Date.now(),
    stroke.fill ? 1 : 0,
    stroke.groupId || null
  );
}

function deleteStroke(boardId, id) {
  const stmt = db.prepare(`DELETE FROM strokes_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- draft_strokes ---
function saveDraftStroke(stroke) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO draft_strokes (id, board_id, user, color, size, points, "order", created_at, fill, group_id, fill_source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    stroke.id,
    stroke.board_id,
    stroke.user,
    stroke.color,
    stroke.size,
    JSON.stringify(stroke.points),
    stroke.order || 0,
    stroke.createdAt || Date.now(),
    stroke.fill ? 1 : 0,
    stroke.groupId || null,
    stroke.fillSourceId || null
  );
}

function deleteDraftStroke(boardId, id, user) {
  const stmt = db.prepare(
    `DELETE FROM draft_strokes WHERE board_id = ? AND id = ? AND user = ?`
  );
  stmt.run(boardId, id, user);
}

function getDraftStrokes(boardId, user) {
  const stmt = db.prepare(`
    SELECT id, color, size, points, "order", created_at, fill, group_id, fill_source_id
    FROM draft_strokes
    WHERE board_id = ? AND user = ?
    ORDER BY "order" ASC
  `);
  return stmt.all(boardId, user).map((row) => ({
    id: row.id,
    color: row.color,
    size: row.size,
    points: JSON.parse(row.points),
    order: row.order,
    createdAt: row.created_at,
    fill: !!row.fill,
    groupId: row.group_id || null,
    fillSourceId: row.fill_source_id || null,
  }));
}

// --- texts_v2 ---
function saveText(text) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO texts_v2 (id, board_id, user, lines, x, y, font_size, color, layer, "order", created_at, label, rotation, vertical, grid_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    text.id,
    text.board_id,
    text.user || null,
    JSON.stringify(text.lines),
    text.x,
    text.y,
    text.fontSize,
    text.color,
    text.layer || "user",
    text.order || 0,
    text.createdAt || Date.now(),
    text.label || null,
    text.rotation || 0,
    text.vertical ? 1 : 0,
    text.gridText ? 1 : 0
  );
}

function deleteText(boardId, id) {
  const stmt = db.prepare(`DELETE FROM texts_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- images_v2 ---
function saveImage(img) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO images_v2 (id, board_id, user, src, x, y, width, height, layer, "order", created_at, rotation, tag_type, tag_label, image_name, image_list_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    img.id,
    img.board_id,
    img.user || null,
    img.src,
    img.x,
    img.y,
    img.width,
    img.height,
    img.layer,
    img.order || 0,
    Date.now(),
    img.rotation || 0,
    img.tagType || null,
    img.tagLabel || null,
    img.imageName || null,
    typeof img.imageListOrder === "number" ? img.imageListOrder : null
  );
}

function deleteImage(boardId, id) {
  const stmt = db.prepare(`DELETE FROM images_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- state ---
function getBoardState(boardId) {
  const strokesStmt = db.prepare(`
    SELECT id, user, color, size, points, layer, "order", fill, group_id
    FROM strokes_v2
    WHERE board_id = ?
    ORDER BY "order" ASC
  `);
  const textsStmt = db.prepare(`
    SELECT id, user, lines, x, y, font_size, color, layer, "order", created_at, label, rotation, vertical, grid_text
    FROM texts_v2
    WHERE board_id = ?
    ORDER BY "order" ASC
  `);
  const imagesStmt = db.prepare(`
    SELECT id, user, src, x, y, width, height, layer, "order", rotation, tag_type, tag_label, image_name, image_list_order
    FROM images_v2
    WHERE board_id = ?
    ORDER BY "order" ASC
  `);

  const title = getBoardTitle(boardId);
  const strokes = strokesStmt.all(boardId).map((row) => ({
    id: row.id,
    user: row.user,
    color: row.color,
    size: row.size,
    points: JSON.parse(row.points),
    layer: row.layer || "user",
    order: row.order,
    fill: !!row.fill,
    groupId: row.group_id || null,
  }));

  const texts = textsStmt.all(boardId).map((row) => ({
    id: row.id,
    user: row.user,
    lines: JSON.parse(row.lines),
    x: row.x,
    y: row.y,
    fontSize: row.font_size,
    color: row.color,
    layer: row.layer || "user",
    order: row.order,
    label: row.label || "",
    rotation: row.rotation || 0,
    vertical: !!row.vertical,
    gridText: !!row.grid_text,
    createdAt: row.created_at,
  }));

  const images = imagesStmt.all(boardId).map((row) => ({
    id: row.id,
    user: row.user,
    src: row.src,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    layer: row.layer,
    order: row.order,
    rotation: row.rotation || 0,
    tagType: row.tag_type || null,
    tagLabel: row.tag_label || "",
    imageName: row.image_name || "",
    imageListOrder: typeof row.image_list_order === "number" ? row.image_list_order : null,
  }));

  return { title, strokes, texts, images };
}

module.exports = {
  createBoard,
  getBoard,
  getBoardTitle,
  setBoardTitle,
  saveStroke,
  deleteStroke,
  saveText,
  deleteText,
  saveImage,
  deleteImage,
  getBoardState,
  saveDraftStroke,
  deleteDraftStroke,
  getDraftStrokes,
  addUser,
  linkUserToBoard,
  getBoardUsers,
};
