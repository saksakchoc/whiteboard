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
  fill_source_id TEXT,
  frame_id TEXT,
  frame_tab TEXT,
  glow_color TEXT,
  shape_type TEXT
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
  grid_text INTEGER NOT NULL DEFAULT 0,
  text_list_order REAL,
  frame_id TEXT,
  frame_tab TEXT,
  draft_board_id TEXT,
  text_memo INTEGER NOT NULL DEFAULT 0,
  memo_items TEXT,
  memo_width REAL,
  memo_height REAL,
  memo_title TEXT,
  memo_scale REAL NOT NULL DEFAULT 1,
  memo_resize_mode TEXT NOT NULL DEFAULT 'fixed',
  calculator INTEGER NOT NULL DEFAULT 0,
  calculator_state TEXT,
  calculator_width REAL,
  calculator_height REAL
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
  mirrored INTEGER NOT NULL DEFAULT 0,
  tag_type TEXT,
  tag_label TEXT,
  image_name TEXT,
  image_list_order REAL,
  frame_id TEXT,
  frame_tab TEXT,
  frame_tabs TEXT,
  active_frame_tab TEXT,
  link_board_source TEXT,
  draft_board_source TEXT,
  draft_board_id TEXT,
  lasso_tool_object INTEGER NOT NULL DEFAULT 0,
  lasso_outline_path TEXT,
  slideshow_slides TEXT,
  slideshow_index INTEGER NOT NULL DEFAULT 0,
  slideshow_drive_board_id TEXT,
  slideshow_drive_folder_id TEXT
);

CREATE TABLE IF NOT EXISTS links_v1 (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user TEXT,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image TEXT,
  favicon TEXT,
  site_name TEXT,
  link_type TEXT,
  source_url TEXT,
  spreadsheet_scale REAL,
  spreadsheet_resize_mode TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  layer TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL
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
  group_id TEXT,
  frame_id TEXT,
  frame_tab TEXT,
  glow_color TEXT,
  draft_board_id TEXT
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

CREATE TABLE IF NOT EXISTS drive_folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_images (
  id TEXT PRIMARY KEY,
  folder_id TEXT,
  name TEXT NOT NULL,
  src TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT,
  source_board_id TEXT,
  source_image_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_roots (
  board_id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL UNIQUE,
  activated INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON drive_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_images_folder ON drive_images(folder_id);
`);

try {
  db.exec("ALTER TABLE drive_roots ADD COLUMN activated INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE drive_images ADD COLUMN captured_at TEXT");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE drive_images ADD COLUMN source_board_id TEXT");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE drive_images ADD COLUMN source_image_id TEXT");
} catch (e) {
  // ignore if column already exists
}

try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN slideshow_slides TEXT");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN slideshow_index INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN slideshow_drive_board_id TEXT");
} catch (e) {
  // ignore if column already exists
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN slideshow_drive_folder_id TEXT");
} catch (e) {
  // ignore if column already exists
}
// A board image may have one link in its board drive and another link in Drive Home.
// Duplicate prevention is therefore handled per board-drive tree when importing.
db.exec(`
  DROP INDEX IF EXISTS idx_drive_images_source;
  CREATE INDEX IF NOT EXISTS idx_drive_images_source_lookup
  ON drive_images(source_board_id, source_image_id)
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
  db.exec("ALTER TABLE texts_v2 ADD COLUMN text_list_order REAL");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN text_memo INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_items TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_width REAL");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_height REAL");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_title TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_scale REAL NOT NULL DEFAULT 1");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN memo_resize_mode TEXT NOT NULL DEFAULT 'fixed'");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN calculator INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN calculator_state TEXT");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN calculator_width REAL");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE texts_v2 ADD COLUMN calculator_height REAL");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN rotation REAL NOT NULL DEFAULT 0");
} catch (e) {
  // ignore
}
try {
  db.exec("ALTER TABLE images_v2 ADD COLUMN mirrored INTEGER NOT NULL DEFAULT 0");
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
[
  ["strokes_v2", "frame_id TEXT"],
  ["strokes_v2", "frame_tab TEXT"],
  ["texts_v2", "frame_id TEXT"],
  ["texts_v2", "frame_tab TEXT"],
  ["texts_v2", "draft_board_id TEXT"],
  ["images_v2", "frame_id TEXT"],
  ["images_v2", "frame_tab TEXT"],
  ["images_v2", "frame_tabs TEXT"],
  ["images_v2", "active_frame_tab TEXT"],
  ["images_v2", "link_board_source TEXT"],
  ["images_v2", "draft_board_source TEXT"],
  ["images_v2", "draft_board_id TEXT"],
  ["images_v2", "lasso_tool_object INTEGER NOT NULL DEFAULT 0"],
  ["images_v2", "lasso_outline_path TEXT"],
  ["draft_strokes", "frame_id TEXT"],
  ["draft_strokes", "frame_tab TEXT"],
  ["strokes_v2", "glow_color TEXT"],
  ["strokes_v2", "shape_type TEXT"],
  ["draft_strokes", "glow_color TEXT"],
  ["draft_strokes", "draft_board_id TEXT"],
  ["links_v1", "favicon TEXT"],
  ["links_v1", "link_type TEXT"],
  ["links_v1", "source_url TEXT"],
  ["links_v1", "spreadsheet_scale REAL"],
  ["links_v1", "spreadsheet_resize_mode TEXT"],
].forEach(([table, column]) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column}`);
  } catch (e) {
    // ignore
  }
});

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

function listBoards() {
  const stmt = db.prepare(`
    SELECT
      b.id,
      b.created_at,
      COALESCE(m.title, b.id) AS title,
      (SELECT COUNT(*) FROM strokes_v2 WHERE board_id = b.id) AS stroke_count,
      (SELECT COUNT(*) FROM texts_v2 WHERE board_id = b.id) AS text_count,
      (SELECT COUNT(*) FROM images_v2 WHERE board_id = b.id) AS image_count,
      (SELECT COUNT(*) FROM links_v1 WHERE board_id = b.id) AS link_count
    FROM boards b
    LEFT JOIN board_meta m ON m.board_id = b.id
    ORDER BY b.created_at DESC
  `);
  return stmt.all();
}

function deleteBoard(boardId) {
  const run = db.transaction((id) => {
    db.prepare("DELETE FROM draft_strokes WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM links_v1 WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM images_v2 WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM texts_v2 WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM strokes_v2 WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM board_users WHERE board_id = ?").run(id);
    db.prepare("DELETE FROM board_meta WHERE board_id = ?").run(id);
    const result = db.prepare("DELETE FROM boards WHERE id = ?").run(id);
    return result.changes;
  });
  return run(boardId);
}

function getBoardTitle(boardId) {
  const stmt = db.prepare("SELECT title FROM board_meta WHERE board_id = ?");
  const row = stmt.get(boardId);
  return row ? row.title : null;
}

function addUser(name, favoriteColor = undefined) {
  if (!name) return;
  const stmt = db.prepare(
    favoriteColor !== undefined
      ? `
        INSERT INTO users (name, favorite_color)
        VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET favorite_color=excluded.favorite_color
      `
      : `
        INSERT OR IGNORE INTO users (name, favorite_color)
        VALUES (?, ?)
      `
  );
  stmt.run(name, favoriteColor || null);
}

function linkUserToBoard(boardId, name, favoriteColor = undefined) {
  if (!boardId || !name) return;
  addUser(name, favoriteColor);
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

// --- simple drive ---
function normalizeDriveParentId(parentId) {
  return parentId ? String(parentId) : null;
}

function getDriveFolder(id) {
  if (!id) return null;
  return db.prepare("SELECT * FROM drive_folders WHERE id = ?").get(id) || null;
}

function getBoardDriveRoot(boardId) {
  const row = db.prepare(`
    SELECT f.* FROM drive_roots r
    JOIN drive_folders f ON f.id = r.folder_id
    WHERE r.board_id = ?
  `).get(boardId);
  return row || null;
}

function listBoardDriveRoots() {
  return db.prepare(`
    SELECT r.board_id, f.id, f.parent_id, f.name, f.created_at
    FROM drive_roots r
    JOIN drive_folders f ON f.id = r.folder_id
    WHERE r.activated = 1
    ORDER BY f.created_at DESC
  `).all();
}

function ensureBoardDrive(boardId, name, rootId, activate = false) {
  const existing = getBoardDriveRoot(boardId);
  if (existing) {
    if (existing.name !== name) {
      db.prepare("UPDATE drive_folders SET name = ? WHERE id = ?").run(name, existing.id);
    }
    if (activate) db.prepare("UPDATE drive_roots SET activated = 1 WHERE board_id = ?").run(boardId);
    return getDriveFolder(existing.id);
  }
  db.transaction(() => {
    db.prepare("INSERT INTO drive_folders (id, parent_id, name, created_at) VALUES (?, NULL, ?, ?)")
      .run(rootId, name, Date.now());
    db.prepare("INSERT INTO drive_roots (board_id, folder_id, activated) VALUES (?, ?, ?)")
      .run(boardId, rootId, activate ? 1 : 0);
  })();
  return getDriveFolder(rootId);
}

function isDriveFolderInBoard(boardId, folderId) {
  const root = getBoardDriveRoot(boardId);
  if (!root || !folderId) return false;
  const visited = new Set();
  let current = getDriveFolder(folderId);
  while (current && !visited.has(current.id)) {
    if (current.id === root.id) return true;
    visited.add(current.id);
    current = current.parent_id ? getDriveFolder(current.parent_id) : null;
  }
  return false;
}

function listDriveFolder(parentId = null) {
  const normalized = normalizeDriveParentId(parentId);
  const where = normalized === null ? "IS NULL" : "= ?";
  const args = normalized === null ? [] : [normalized];
  return {
    folders: db.prepare(`
      SELECT id, parent_id, name, created_at
      FROM drive_folders WHERE parent_id ${where}
      ORDER BY name COLLATE NOCASE ASC, created_at ASC
    `).all(...args),
    images: db.prepare(`
      SELECT id, folder_id, name, src, mime_type, size, captured_at, source_board_id, source_image_id, created_at
      FROM drive_images WHERE folder_id ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...args),
  };
}

function listDriveFolderImagesRecursive(folderId) {
  if (!folderId) return [];
  return db.prepare(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM drive_folders WHERE id = ?
      UNION ALL
      SELECT child.id FROM drive_folders child
      JOIN folder_tree parent ON child.parent_id = parent.id
    )
    SELECT id, folder_id, name, src, mime_type, size, captured_at,
           source_board_id, source_image_id, created_at
    FROM drive_images
    WHERE folder_id IN (SELECT id FROM folder_tree)
    ORDER BY created_at ASC, rowid ASC
  `).all(folderId);
}

function getDriveBreadcrumb(folderId) {
  const breadcrumb = [];
  const visited = new Set();
  let current = folderId ? getDriveFolder(folderId) : null;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    breadcrumb.unshift({ id: current.id, name: current.name });
    current = current.parent_id ? getDriveFolder(current.parent_id) : null;
  }
  return breadcrumb;
}

function createDriveFolder(folder) {
  db.prepare(`
    INSERT INTO drive_folders (id, parent_id, name, created_at)
    VALUES (?, ?, ?, ?)
  `).run(folder.id, normalizeDriveParentId(folder.parentId), folder.name, folder.createdAt || Date.now());
  return getDriveFolder(folder.id);
}

function renameDriveFolder(id, name) {
  const result = db.prepare("UPDATE drive_folders SET name = ? WHERE id = ?").run(name, id);
  return result.changes ? getDriveFolder(id) : null;
}

function createDriveImage(image) {
  const result = db.prepare(`
    INSERT OR IGNORE INTO drive_images
      (id, folder_id, name, src, mime_type, size, captured_at, source_board_id, source_image_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    image.id,
    normalizeDriveParentId(image.folderId),
    image.name,
    image.src,
    image.mimeType || null,
    image.size || 0,
    image.capturedAt || null,
    image.sourceBoardId || null,
    image.sourceImageId || null,
    image.createdAt || Date.now()
  );
  return getDriveImage(image.id);
}

function getBoardDriveImageBySource(boardId, sourceImageId) {
  if (!boardId || !sourceImageId) return null;
  const candidates = db.prepare(`
    SELECT * FROM drive_images
    WHERE source_board_id = ? AND source_image_id = ? AND folder_id IS NOT NULL
    ORDER BY created_at ASC, rowid ASC
  `).all(boardId, sourceImageId);
  return candidates.find((image) => isDriveFolderInBoard(boardId, image.folder_id)) || null;
}

function listBoardImagesForDrive(boardId) {
  return db.prepare(`
    SELECT id, src, image_name, created_at
    FROM images_v2
    WHERE board_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(boardId);
}

function getDriveImage(id) {
  if (!id) return null;
  return db.prepare("SELECT * FROM drive_images WHERE id = ?").get(id) || null;
}

function renameDriveImage(id, name) {
  const result = db.prepare("UPDATE drive_images SET name = ? WHERE id = ?").run(name, id);
  return result.changes ? getDriveImage(id) : null;
}

function moveDriveImages(imageIds, targetFolderId) {
  const move = db.transaction((ids) => {
    const stmt = db.prepare("UPDATE drive_images SET folder_id = ? WHERE id = ?");
    let changes = 0;
    ids.forEach((id) => {
      changes += stmt.run(normalizeDriveParentId(targetFolderId), id).changes;
    });
    return changes;
  });
  return move(imageIds);
}

function deleteDriveImage(id) {
  const image = getDriveImage(id);
  if (!image) return null;
  db.prepare("DELETE FROM drive_images WHERE id = ?").run(id);
  return image;
}

function deleteDriveFolder(id) {
  if (!id || !getDriveFolder(id)) return null;
  const folderIds = [];
  const collect = (folderId) => {
    folderIds.push(folderId);
    db.prepare("SELECT id FROM drive_folders WHERE parent_id = ?").all(folderId).forEach((row) => collect(row.id));
  };
  collect(id);
  const placeholders = folderIds.map(() => "?").join(",");
  const images = db.prepare(`SELECT * FROM drive_images WHERE folder_id IN (${placeholders})`).all(...folderIds);
  db.transaction(() => {
    db.prepare(`DELETE FROM drive_roots WHERE folder_id IN (${placeholders})`).run(...folderIds);
    db.prepare(`DELETE FROM drive_images WHERE folder_id IN (${placeholders})`).run(...folderIds);
    [...folderIds].reverse().forEach((folderId) => {
      db.prepare("DELETE FROM drive_folders WHERE id = ?").run(folderId);
    });
  })();
  return { folderIds, images };
}

function setBoardTitle(boardId, title) {
  const stmt = db.prepare(`
    INSERT INTO board_meta (board_id, title)
    VALUES (?, ?)
    ON CONFLICT(board_id) DO UPDATE SET title=excluded.title
  `);
  stmt.run(boardId, title);
  db.prepare(`
    UPDATE drive_folders SET name = ?
    WHERE id = (SELECT folder_id FROM drive_roots WHERE board_id = ?)
  `).run(title, boardId);
}

// --- strokes_v2 ---
function saveStroke(stroke) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO strokes_v2 (id, board_id, user, color, size, points, layer, "order", created_at, fill, group_id, frame_id, frame_tab, glow_color, shape_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    stroke.groupId || null,
    stroke.frameId || null,
    stroke.frameTab || null,
    stroke.glowColor || null,
    stroke.shapeType || null
  );
}

function deleteStroke(boardId, id) {
  const stmt = db.prepare(`DELETE FROM strokes_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- draft_strokes ---
function saveDraftStroke(stroke) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO draft_strokes (id, board_id, user, color, size, points, "order", created_at, fill, group_id, fill_source_id, frame_id, frame_tab, glow_color, draft_board_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    stroke.fillSourceId || null,
    stroke.frameId || null,
    stroke.frameTab || null,
    stroke.glowColor || null,
    stroke.draftBoardId || null
  );
}

function deleteDraftStroke(boardId, id, user) {
  const stmt = db.prepare(
    `DELETE FROM draft_strokes WHERE board_id = ? AND id = ? AND user = ?`
  );
  stmt.run(boardId, id, user);
}

function deleteDraftBoardContents(boardId, draftBoardId, user) {
  const remove = db.transaction(() => {
    db.prepare(
      `DELETE FROM draft_strokes WHERE board_id = ? AND draft_board_id = ? AND user = ?`
    ).run(boardId, draftBoardId, user);
    db.prepare(
      `DELETE FROM texts_v2 WHERE board_id = ? AND draft_board_id = ? AND user = ?`
    ).run(boardId, draftBoardId, user);
    db.prepare(
      `DELETE FROM images_v2 WHERE board_id = ? AND draft_board_id = ? AND user = ?`
    ).run(boardId, draftBoardId, user);
  });
  remove();
}

function getDraftStrokes(boardId, user) {
  const stmt = db.prepare(`
    SELECT id, user, color, size, points, "order", created_at, fill, group_id, fill_source_id, frame_id, frame_tab, glow_color, draft_board_id
    FROM draft_strokes
    WHERE board_id = ? AND user = ?
    ORDER BY "order" ASC
  `);
  return stmt.all(boardId, user).map((row) => ({
    id: row.id,
    user: row.user,
    color: row.color,
    size: row.size,
    points: JSON.parse(row.points),
    order: row.order,
    createdAt: row.created_at,
    fill: !!row.fill,
    groupId: row.group_id || null,
    fillSourceId: row.fill_source_id || null,
    frameId: row.frame_id || null,
    frameTab: row.frame_tab || null,
    glowColor: row.glow_color || null,
    draftBoardId: row.draft_board_id || null,
  }));
}

// --- texts_v2 ---
function saveText(text) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO texts_v2 (id, board_id, user, lines, x, y, font_size, color, layer, "order", created_at, label, rotation, vertical, grid_text, text_list_order, frame_id, frame_tab, draft_board_id, text_memo, memo_items, memo_width, memo_height, memo_title, memo_scale, memo_resize_mode, calculator, calculator_state, calculator_width, calculator_height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    text.gridText ? 1 : 0,
    typeof text.textListOrder === "number" ? text.textListOrder : null,
    text.frameId || null,
    text.frameTab || null,
    text.draftBoardId || null,
    text.textMemo ? 1 : 0,
    text.textMemo ? JSON.stringify(text.memoItems || []) : null,
    text.textMemo ? text.memoWidth || 320 : null,
    text.textMemo ? text.memoHeight || 260 : null,
    text.textMemo ? text.memoTitle || "テキストメモ" : null,
    text.textMemo ? text.memoScale || 1 : 1,
    text.textMemo ? text.memoResizeMode || "fixed" : "fixed",
    text.calculator ? 1 : 0,
    text.calculator ? JSON.stringify(text.calculatorState || {}) : null,
    text.calculator ? text.calculatorWidth || 280 : null,
    text.calculator ? text.calculatorHeight || 390 : null
  );
}

function deleteText(boardId, id) {
  const stmt = db.prepare(`DELETE FROM texts_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- images_v2 ---
function saveImage(img) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO images_v2 (id, board_id, user, src, x, y, width, height, layer, "order", created_at, rotation, mirrored, tag_type, tag_label, image_name, image_list_order, frame_id, frame_tab, frame_tabs, active_frame_tab, link_board_source, draft_board_source, draft_board_id, lasso_tool_object, lasso_outline_path, slideshow_slides, slideshow_index, slideshow_drive_board_id, slideshow_drive_folder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    img.mirrored ? 1 : 0,
    img.tagType || null,
    img.tagLabel || null,
    img.imageName || null,
    typeof img.imageListOrder === "number" ? img.imageListOrder : null,
    img.frameId || null,
    img.frameTab || null,
    img.frameTabs ? JSON.stringify(img.frameTabs) : null,
    img.activeFrameTab || null,
    img.linkBoardSource ? JSON.stringify(img.linkBoardSource) : null,
    img.draftBoardSource ? JSON.stringify(img.draftBoardSource) : null,
    img.draftBoardId || null,
    img.lassoToolObject ? 1 : 0,
    Array.isArray(img.lassoOutlinePath) ? JSON.stringify(img.lassoOutlinePath) : null,
    Array.isArray(img.slideshowSlides) ? JSON.stringify(img.slideshowSlides) : null,
    Number.isInteger(img.slideshowIndex) ? img.slideshowIndex : 0,
    img.slideshowDriveBoardId || null,
    img.slideshowDriveFolderId || null
  );
}

function deleteImage(boardId, id) {
  const stmt = db.prepare(`DELETE FROM images_v2 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- links_v1 ---
function saveLink(link) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO links_v1 (id, board_id, user, url, title, description, image, favicon, site_name, link_type, source_url, spreadsheet_scale, spreadsheet_resize_mode, x, y, width, height, layer, "order", created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    link.id,
    link.board_id,
    link.user || null,
    link.url,
    link.title || null,
    link.description || null,
    link.image || null,
    link.favicon || null,
    link.siteName || null,
    link.linkType || null,
    link.sourceUrl || null,
    link.spreadsheetScale || 1,
    link.spreadsheetResizeMode || "fixed",
    link.x,
    link.y,
    link.width || 320,
    link.height || 150,
    link.layer || "user",
    link.order || 0,
    link.createdAt || Date.now()
  );
}

function deleteLink(boardId, id) {
  const stmt = db.prepare(`DELETE FROM links_v1 WHERE board_id = ? AND id = ?`);
  stmt.run(boardId, id);
}

// --- state ---
function getBoardState(boardId) {
  const strokesStmt = db.prepare(`
    SELECT s.id, s.user, s.color, s.size, s.points, s.layer, s."order", s.fill, s.group_id, s.frame_id, s.frame_tab,
           COALESCE(s.glow_color, u.favorite_color) AS glow_color, s.shape_type
    FROM strokes_v2 s
    LEFT JOIN users u ON u.name = s.user
    WHERE s.board_id = ?
    ORDER BY s."order" ASC
  `);
  const textsStmt = db.prepare(`
    SELECT id, user, lines, x, y, font_size, color, layer, "order", created_at, label, rotation, vertical, grid_text, text_list_order, frame_id, frame_tab, draft_board_id, text_memo, memo_items, memo_width, memo_height, memo_title, memo_scale, memo_resize_mode, calculator, calculator_state, calculator_width, calculator_height
    FROM texts_v2
    WHERE board_id = ?
    ORDER BY "order" ASC
  `);
  const imagesStmt = db.prepare(`
    SELECT id, user, src, x, y, width, height, layer, "order", rotation, mirrored, tag_type, tag_label, image_name, image_list_order, frame_id, frame_tab, frame_tabs, active_frame_tab, link_board_source, draft_board_source, draft_board_id, lasso_tool_object, lasso_outline_path, slideshow_slides, slideshow_index, slideshow_drive_board_id, slideshow_drive_folder_id
    FROM images_v2
    WHERE board_id = ?
    ORDER BY "order" ASC
  `);
  const linksStmt = db.prepare(`
    SELECT id, user, url, title, description, image, favicon, site_name, link_type, source_url, spreadsheet_scale, spreadsheet_resize_mode, x, y, width, height, layer, "order", created_at
    FROM links_v1
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
    frameId: row.frame_id || null,
    frameTab: row.frame_tab || null,
    glowColor: row.glow_color || null,
    shapeType: row.shape_type || null,
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
    textListOrder: typeof row.text_list_order === "number" ? row.text_list_order : null,
    createdAt: row.created_at,
    frameId: row.frame_id || null,
    frameTab: row.frame_tab || null,
    draftBoardId: row.draft_board_id || null,
    textMemo: !!row.text_memo,
    memoItems: row.memo_items ? JSON.parse(row.memo_items) : [],
    memoWidth: row.memo_width || 320,
    memoHeight: row.memo_height || 260,
    memoTitle: row.memo_title || "テキストメモ",
    memoScale: row.memo_scale || 1,
    memoResizeMode: row.memo_resize_mode === "scale" ? "scale" : "fixed",
    calculator: !!row.calculator,
    calculatorState: row.calculator_state ? JSON.parse(row.calculator_state) : null,
    calculatorWidth: row.calculator_width || 280,
    calculatorHeight: row.calculator_height || 390,
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
    mirrored: !!row.mirrored,
    tagType: row.tag_type || null,
    tagLabel: row.tag_label || "",
    imageName: row.image_name || "",
    imageListOrder: typeof row.image_list_order === "number" ? row.image_list_order : null,
    frameId: row.frame_id || null,
    frameTab: row.frame_tab || null,
    frameTabs: row.frame_tabs ? JSON.parse(row.frame_tabs) : null,
    activeFrameTab: row.active_frame_tab || null,
    linkBoardSource: row.link_board_source ? JSON.parse(row.link_board_source) : null,
    draftBoardSource: row.draft_board_source ? JSON.parse(row.draft_board_source) : null,
    draftBoardId: row.draft_board_id || null,
    lassoToolObject: !!row.lasso_tool_object,
    lassoOutlinePath: row.lasso_outline_path ? JSON.parse(row.lasso_outline_path) : null,
    slideshowSlides: row.slideshow_slides ? JSON.parse(row.slideshow_slides) : null,
    slideshowIndex: Number.isInteger(row.slideshow_index) ? row.slideshow_index : 0,
    slideshowDriveBoardId: row.slideshow_drive_board_id || null,
    slideshowDriveFolderId: row.slideshow_drive_folder_id || null,
  }));

  const links = linksStmt.all(boardId).map((row) => ({
    id: row.id,
    user: row.user,
    url: row.url,
    title: row.title || "",
    description: row.description || "",
    image: row.image || "",
    favicon: row.favicon || "",
    siteName: row.site_name || "",
    linkType: row.link_type || "link",
    sourceUrl: row.source_url || "",
    spreadsheetScale: row.spreadsheet_scale || 1,
    spreadsheetResizeMode: row.spreadsheet_resize_mode === "scale" ? "scale" : "fixed",
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    layer: row.layer || "user",
    order: row.order,
    createdAt: row.created_at,
  }));

  return { title, strokes, texts, images, links };
}

module.exports = {
  createBoard,
  getBoard,
  listBoards,
  deleteBoard,
  getBoardTitle,
  setBoardTitle,
  saveStroke,
  deleteStroke,
  saveText,
  deleteText,
  saveImage,
  deleteImage,
  saveLink,
  deleteLink,
  getBoardState,
  saveDraftStroke,
  deleteDraftStroke,
  deleteDraftBoardContents,
  getDraftStrokes,
  addUser,
  linkUserToBoard,
  getBoardUsers,
  getDriveFolder,
  getBoardDriveRoot,
  listBoardDriveRoots,
  ensureBoardDrive,
  isDriveFolderInBoard,
  listDriveFolder,
  listDriveFolderImagesRecursive,
  getDriveBreadcrumb,
  createDriveFolder,
  renameDriveFolder,
  createDriveImage,
  getBoardDriveImageBySource,
  listBoardImagesForDrive,
  getDriveImage,
  renameDriveImage,
  moveDriveImages,
  deleteDriveImage,
  deleteDriveFolder,
};
