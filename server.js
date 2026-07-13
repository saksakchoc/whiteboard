// server.js（ステップ1：ボード作成まで）
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { Server } = require("socket.io");
const multer = require("multer");

const {
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
} = require("./db");

// 設定
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "";
const SSL_CA_PATH = process.env.SSL_CA_PATH || "";
const dataDir = path.join(__dirname, "data");

const app = express();

function createHttpServer(app) {
  if (!SSL_KEY_PATH && !SSL_CERT_PATH) {
    return { server: http.createServer(app), protocol: "http" };
  }
  if (!SSL_KEY_PATH || !SSL_CERT_PATH) {
    throw new Error("SSL_KEY_PATH and SSL_CERT_PATH must both be set to enable HTTPS.");
  }
  const options = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  };
  if (SSL_CA_PATH) {
    options.ca = fs.readFileSync(SSL_CA_PATH);
  }
  return { server: https.createServer(options, app), protocol: "https" };
}

const { server, protocol } = createHttpServer(app);
const io = new Server(server, {
  maxHttpBufferSize: Number(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || 50 * 1024 * 1024),
});

// JSON / 静的ファイル
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// アップロード先（まだ使わないけど作っておく）
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// multer 設定（ここも後で使う）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const boardId = req.params.boardId || "common";
    const dest = path.join(uploadsDir, boardId);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-]/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});
const upload = multer({ storage });

const driveUploadsDir = path.join(uploadsDir, "drive");
fs.mkdirSync(driveUploadsDir, { recursive: true });
const driveUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, driveUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").replace(/[^.a-zA-Z0-9]/g, "").slice(0, 10);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"]);
    const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/avif"]);
    const extensionMatches = imageExtensions.has(path.extname(file.originalname || "").toLowerCase());
    const isImage = imageMimeTypes.has(String(file.mimetype || "").toLowerCase()) ||
      (file.mimetype === "application/octet-stream" && extensionMatches);
    cb(isImage ? null : new Error("images only"), isImage);
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 30 },
});

function safeFilePart(value, fallback = "file") {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || fallback;
}

function dataUrlExtension(mime) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "png";
}

function materializeImageSrc(boardId, image) {
  if (!image || typeof image.src !== "string") return image;
  const match = image.src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return image;

  const boardDir = path.join(uploadsDir, safeFilePart(boardId, "board"));
  fs.mkdirSync(boardDir, { recursive: true });
  const ext = dataUrlExtension(match[1].toLowerCase());
  const filename = `${safeFilePart(image.id, `image_${Date.now()}`)}.${ext}`;
  const filePath = path.join(boardDir, filename);
  fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
  return {
    ...image,
    src: `/uploads/${safeFilePart(boardId, "board")}/${filename}`,
  };
}

function removeBoardUploads(boardId) {
  const boardDir = path.resolve(uploadsDir, safeFilePart(boardId, "board"));
  const uploadsRoot = path.resolve(uploadsDir);
  if (!boardDir.startsWith(`${uploadsRoot}${path.sep}`)) return;
  fs.rmSync(boardDir, { recursive: true, force: true });
}

// ランダムなボードID生成
function generateBoardId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ルート：トップページ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function logBoardCreation(req, boardId) {
  const entry = {
    at: new Date().toISOString(),
    boardId,
    ip: req.ip,
    ips: req.ips,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get("user-agent") || "",
    origin: req.get("origin") || "",
    referer: req.get("referer") || "",
  };
  fs.appendFile(
    path.join(dataDir, "board-create-audit.log"),
    `${JSON.stringify(entry)}\n`,
    (err) => {
      if (err) console.error("Failed to write board creation audit log", err);
    }
  );
}

function createNewBoardId(req) {
  let id;
  do {
    id = generateBoardId();
  } while (getBoard(id)); // かぶり防止

  createBoard(id);
  logBoardCreation(req, id);
  return id;
}

// 新しいボードを作成してリダイレクト
app.post("/new", (req, res) => {
  const id = createNewBoardId(req);
  res.redirect(`/b/${id}`);
});

app.post("/api/boards", (req, res) => {
  try {
    const id = createNewBoardId(req);
    res.status(201).json({ id, url: `/b/${id}` });
  } catch (err) {
    console.error("Failed to create board", err);
    res.status(500).json({ error: "failed to create board" });
  }
});

app.get("/new", (req, res) => {
  res.redirect("/");
});

app.get("/api/boards", (req, res) => {
  try {
    res.json(
      listBoards().map((board) => ({
        id: board.id,
        title: board.title || board.id,
        createdAt: board.created_at,
        counts: {
          strokes: board.stroke_count || 0,
          texts: board.text_count || 0,
          images: board.image_count || 0,
          links: board.link_count || 0,
        },
      }))
    );
  } catch (err) {
    console.error("Failed to list boards", err);
    res.status(500).json({ error: "failed to list boards" });
  }
});

app.delete("/api/boards/:boardId", (req, res) => {
  const boardId = req.params.boardId;
  if (!boardId) return res.status(400).json({ error: "boardId is required" });
  try {
    const driveRoot = getBoardDriveRoot(boardId);
    if (driveRoot) {
      const driveData = deleteDriveFolder(driveRoot.id);
      driveData?.images.forEach((image) => {
        if (!image.source_image_id) removeDriveUpload(image.src);
      });
    }
    const deleted = deleteBoard(boardId);
    if (!deleted) return res.status(404).json({ error: "board not found" });
    boardStates.delete(boardId);
    io.to(boardId).emit("error-message", "このボードは削除されました。");
    io.in(boardId).disconnectSockets(true);
    removeBoardUploads(boardId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete board", err);
    res.status(500).json({ error: "failed to delete board" });
  }
});

// ボード画面
app.get("/b/:boardId", (req, res) => {
  const boardId = req.params.boardId;
  const board = getBoard(boardId);
  if (!board) {
    return res.status(404).send("Board not found");
  }
  res.sendFile(path.join(__dirname, "public", "board.html"));
});

// テンプレ画像一覧
app.get("/api/templates", (req, res) => {
  const templatesDir = path.join(__dirname, "public", "templates");
  try {
    if (!fs.existsSync(templatesDir)) {
      return res.json([]);
    }
    const files = fs
      .readdirSync(templatesDir)
      .filter((f) => f.toLowerCase().endsWith(".png"));
    res.json(files.map((f) => f));
  } catch (err) {
    console.error("Failed to read templates", err);
    res.status(500).json({ error: "failed to read templates" });
  }
});

function driveImageResponse(row) {
  return {
    id: row.id,
    folderId: row.folder_id || null,
    name: normalizeUploadedFilename(row.name),
    src: row.src,
    mimeType: row.mime_type || "",
    size: row.size || 0,
    capturedAt: row.captured_at || null,
    linkedFromBoard: !!row.source_image_id,
    createdAt: row.created_at,
  };
}

function normalizeUploadedFilename(value) {
  const raw = String(value || "image");
  if (!/[\u0080-\u00ff]/.test(raw)) return raw;
  const decoded = Buffer.from(raw, "latin1").toString("utf8");
  return decoded.includes("\ufffd") ? raw : decoded;
}

function inferImageMimeType(src) {
  const dataMime = String(src || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);/i)?.[1];
  if (dataMime) return dataMime.toLowerCase();
  const extension = path.extname(String(src || "").split(/[?#]/, 1)[0]).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
  }[extension] || "image/png";
}

function readExifCapturedAt(filePath, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime !== "image/jpeg" && !/\.jpe?g$/i.test(filePath || "")) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      const dataStart = offset + 4;
      const dataEnd = Math.min(buffer.length, offset + 2 + length);
      if (marker === 0xe1 && dataEnd - dataStart >= 14 && buffer.toString("ascii", dataStart, dataStart + 6) === "Exif\0\0") {
        const tiffStart = dataStart + 6;
        const littleEndian = buffer.toString("ascii", tiffStart, tiffStart + 2) === "II";
        const bigEndian = buffer.toString("ascii", tiffStart, tiffStart + 2) === "MM";
        if (!littleEndian && !bigEndian) return null;
        const readU16 = (position) => {
          if (position < tiffStart || position + 2 > dataEnd) throw new Error("invalid exif offset");
          return littleEndian ? buffer.readUInt16LE(position) : buffer.readUInt16BE(position);
        };
        const readU32 = (position) => {
          if (position < tiffStart || position + 4 > dataEnd) throw new Error("invalid exif offset");
          return littleEndian ? buffer.readUInt32LE(position) : buffer.readUInt32BE(position);
        };
        const readAscii = (entryOffset, count) => {
          const valueOffset = count <= 4 ? entryOffset + 8 : tiffStart + readU32(entryOffset + 8);
          if (count < 1 || valueOffset < tiffStart || valueOffset + count > dataEnd) return "";
          return buffer.toString("ascii", valueOffset, valueOffset + count).replace(/\0+$/, "").trim();
        };
        const readIfd = (relativeOffset) => {
          const result = new Map();
          const ifdOffset = tiffStart + relativeOffset;
          const count = readU16(ifdOffset);
          for (let index = 0; index < count; index += 1) {
            const entryOffset = ifdOffset + 2 + index * 12;
            if (entryOffset + 12 > dataEnd) break;
            const tag = readU16(entryOffset);
            const type = readU16(entryOffset + 2);
            const valueCount = readU32(entryOffset + 4);
            result.set(tag, { entryOffset, type, valueCount, value: readU32(entryOffset + 8) });
          }
          return result;
        };
        const ifd0 = readIfd(readU32(tiffStart + 4));
        const exifPointer = ifd0.get(0x8769)?.value;
        const exifIfd = exifPointer ? readIfd(exifPointer) : new Map();
        const dateEntry = exifIfd.get(0x9003) || exifIfd.get(0x9004) || ifd0.get(0x0132);
        const raw = dateEntry?.type === 2 ? readAscii(dateEntry.entryOffset, dateEntry.valueCount) : "";
        const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : null;
      }
      offset = dataEnd;
    }
  } catch (err) {
    console.warn("Failed to read image EXIF metadata", err.message);
  }
  return null;
}

function removeDriveUpload(src) {
  if (typeof src !== "string" || !src.startsWith("/uploads/drive/")) return;
  const filename = path.basename(src);
  const target = path.resolve(driveUploadsDir, filename);
  if (path.dirname(target) !== path.resolve(driveUploadsDir)) return;
  fs.rmSync(target, { force: true });
}

app.get("/api/drive/home", (_req, res) => {
  try {
    const folders = listBoardDriveRoots().map((root) => ({
      id: root.id,
      boardId: root.board_id,
      name: root.name,
      createdAt: root.created_at,
    }));
    const images = listDriveFolder(null).images.map(driveImageResponse);
    res.json({ folders, images });
  } catch (err) {
    console.error("Failed to list drive home", err);
    res.status(500).json({ error: "failed to list drive home" });
  }
});

app.post("/api/drive/move-images", (req, res) => {
  try {
    const imageIds = Array.from(new Set(
      (Array.isArray(req.body?.imageIds) ? req.body.imageIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )).slice(0, 1000);
    const targetFolderId = req.body?.targetFolderId == null
      ? null
      : String(req.body.targetFolderId).trim() || null;
    if (!imageIds.length) return res.status(400).json({ error: "invalid params" });
    if (targetFolderId && !getDriveFolder(targetFolderId)) {
      return res.status(404).json({ error: "target folder not found" });
    }
    if (imageIds.some((id) => !getDriveImage(id))) {
      return res.status(404).json({ error: "image not found" });
    }
    const moved = moveDriveImages(imageIds, targetFolderId);
    res.json({ moved, targetFolderId });
  } catch (err) {
    console.error("Failed to move drive images", err);
    res.status(500).json({ error: "failed to move images" });
  }
});

app.patch("/api/drive/images/:imageId", (req, res) => {
  try {
    const image = getDriveImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: "image not found" });
    const name = String(req.body?.name || "").trim().slice(0, 255);
    if (!name) return res.status(400).json({ error: "name is required" });
    res.json(driveImageResponse(renameDriveImage(image.id, name)));
  } catch (err) {
    console.error("Failed to rename home drive image", err);
    res.status(500).json({ error: "failed to rename image" });
  }
});

app.delete("/api/drive/images/:imageId", (req, res) => {
  try {
    const image = getDriveImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: "image not found" });
    deleteDriveImage(image.id);
    if (!image.source_image_id) removeDriveUpload(image.src);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete home drive image", err);
    res.status(500).json({ error: "failed to delete image" });
  }
});

app.get("/api/boards/:boardId/drive", (req, res) => {
  try {
    const board = getBoard(req.params.boardId);
    if (!board) return res.status(404).json({ error: "board not found" });
    const title = getBoardTitle(board.id) || board.id;
    const root = ensureBoardDrive(board.id, title, crypto.randomUUID(), true);
    const folderId = String(req.query.folderId || "").trim() || root.id;
    if (!isDriveFolderInBoard(board.id, folderId)) return res.status(404).json({ error: "folder not found" });
    const contents = listDriveFolder(folderId);
    res.json({
      folderId,
      rootFolderId: root.id,
      breadcrumb: getDriveBreadcrumb(folderId),
      folders: contents.folders.map((row) => ({
        id: row.id,
        parentId: row.parent_id || null,
        name: row.name,
        createdAt: row.created_at,
      })),
      images: contents.images.map(driveImageResponse),
    });
  } catch (err) {
    console.error("Failed to list drive", err);
    res.status(500).json({ error: "failed to list drive" });
  }
});

app.post("/api/boards/:boardId/drive/folders", (req, res) => {
  try {
    const board = getBoard(req.params.boardId);
    if (!board) return res.status(404).json({ error: "board not found" });
    const root = ensureBoardDrive(board.id, getBoardTitle(board.id) || board.id, crypto.randomUUID(), true);
    const name = String(req.body?.name || "").trim().slice(0, 100);
    const parentId = String(req.body?.parentId || "").trim() || root.id;
    if (!name) return res.status(400).json({ error: "name is required" });
    if (!isDriveFolderInBoard(board.id, parentId)) return res.status(404).json({ error: "parent folder not found" });
    const folder = createDriveFolder({ id: crypto.randomUUID(), parentId, name, createdAt: Date.now() });
    res.status(201).json({ id: folder.id, parentId: folder.parent_id || null, name: folder.name, createdAt: folder.created_at });
  } catch (err) {
    console.error("Failed to create drive folder", err);
    res.status(500).json({ error: "failed to create folder" });
  }
});

app.post("/api/boards/:boardId/drive/images", (req, res) => {
  driveUpload.array("images", 30)(req, res, (uploadErr) => {
    const uploadedFiles = Array.from(req.files || []);
    const cleanup = () => uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
    if (uploadErr) {
      cleanup();
      return res.status(400).json({ error: uploadErr.message || "upload failed" });
    }
    try {
      const board = getBoard(req.params.boardId);
      if (!board) {
        cleanup();
        return res.status(404).json({ error: "board not found" });
      }
      const root = ensureBoardDrive(board.id, getBoardTitle(board.id) || board.id, crypto.randomUUID(), true);
      const folderId = String(req.body?.folderId || "").trim() || root.id;
      if (!isDriveFolderInBoard(board.id, folderId)) {
        cleanup();
        return res.status(404).json({ error: "folder not found" });
      }
      if (!uploadedFiles.length) return res.status(400).json({ error: "images are required" });
      const images = uploadedFiles.map((file) => createDriveImage({
        id: crypto.randomUUID(),
        folderId,
        name: normalizeUploadedFilename(file.originalname).slice(0, 255),
        src: `/uploads/drive/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        capturedAt: readExifCapturedAt(file.path, file.mimetype),
        createdAt: Date.now(),
      }));
      res.status(201).json(images.map(driveImageResponse));
    } catch (err) {
      cleanup();
      console.error("Failed to save drive images", err);
      res.status(500).json({ error: "failed to save images" });
    }
  });
});

app.post("/api/boards/:boardId/drive/import-board-images", (req, res) => {
  try {
    const board = getBoard(req.params.boardId);
    if (!board) return res.status(404).json({ error: "board not found" });
    const root = ensureBoardDrive(board.id, getBoardTitle(board.id) || board.id, crypto.randomUUID(), true);
    const sourceImages = listBoardImagesForDrive(board.id);
    const importedAt = Date.now();
    let added = 0;
    const images = sourceImages.map((source, index) => {
      const existing = getBoardDriveImageBySource(board.id, source.id);
      if (existing) return existing;
      let fallbackName = `board-image-${index + 1}`;
      try {
        const filename = path.basename(String(source.src || "").split(/[?#]/, 1)[0]);
        if (filename && filename.length < 256) fallbackName = decodeURIComponent(filename);
      } catch {
        // use generated fallback name
      }
      const id = crypto.randomUUID();
      const image = createDriveImage({
        id,
        folderId: root.id,
        name: normalizeUploadedFilename(source.image_name || fallbackName),
        src: source.src,
        mimeType: inferImageMimeType(source.src),
        size: 0,
        sourceBoardId: board.id,
        sourceImageId: source.id,
        createdAt: importedAt + index,
      });
      if (image?.id === id) added += 1;
      return image;
    }).filter(Boolean);
    res.json({ added, existing: images.length - added, total: images.length, images: images.map(driveImageResponse) });
  } catch (err) {
    console.error("Failed to link board images to drive", err);
    res.status(500).json({ error: "failed to import board images" });
  }
});

app.post("/api/boards/:boardId/drive/move-images", (req, res) => {
  try {
    const board = getBoard(req.params.boardId);
    if (!board) return res.status(404).json({ error: "board not found" });
    const imageIds = Array.from(new Set(
      (Array.isArray(req.body?.imageIds) ? req.body.imageIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )).slice(0, 1000);
    const targetFolderId = String(req.body?.targetFolderId || "").trim();
    if (!imageIds.length || !targetFolderId) return res.status(400).json({ error: "invalid params" });
    if (!isDriveFolderInBoard(board.id, targetFolderId)) {
      return res.status(404).json({ error: "target folder not found" });
    }
    const invalidImage = imageIds.some((id) => {
      const image = getDriveImage(id);
      return !image || !isDriveFolderInBoard(board.id, image.folder_id);
    });
    if (invalidImage) return res.status(404).json({ error: "image not found" });
    const moved = moveDriveImages(imageIds, targetFolderId);
    res.json({ moved, targetFolderId });
  } catch (err) {
    console.error("Failed to move drive images", err);
    res.status(500).json({ error: "failed to move images" });
  }
});

app.patch("/api/boards/:boardId/drive/images/:imageId", (req, res) => {
  try {
    const image = getDriveImage(req.params.imageId);
    if (!image || !isDriveFolderInBoard(req.params.boardId, image.folder_id)) {
      return res.status(404).json({ error: "image not found" });
    }
    const name = String(req.body?.name || "").trim().slice(0, 255);
    if (!name) return res.status(400).json({ error: "name is required" });
    res.json(driveImageResponse(renameDriveImage(image.id, name)));
  } catch (err) {
    console.error("Failed to rename drive image", err);
    res.status(500).json({ error: "failed to rename image" });
  }
});

app.patch("/api/boards/:boardId/drive/folders/:folderId", (req, res) => {
  try {
    const root = getBoardDriveRoot(req.params.boardId);
    if (!root || root.id === req.params.folderId || !isDriveFolderInBoard(req.params.boardId, req.params.folderId)) {
      return res.status(404).json({ error: "folder not found" });
    }
    const name = String(req.body?.name || "").trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: "name is required" });
    const folder = renameDriveFolder(req.params.folderId, name);
    res.json({ id: folder.id, parentId: folder.parent_id || null, name: folder.name, createdAt: folder.created_at });
  } catch (err) {
    console.error("Failed to rename drive folder", err);
    res.status(500).json({ error: "failed to rename folder" });
  }
});

app.delete("/api/boards/:boardId/drive/images/:imageId", (req, res) => {
  try {
    const imageRow = getDriveImage(req.params.imageId);
    if (!imageRow || !isDriveFolderInBoard(req.params.boardId, imageRow.folder_id)) {
      return res.status(404).json({ error: "image not found" });
    }
    const image = deleteDriveImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: "image not found" });
    if (!image.source_image_id) removeDriveUpload(image.src);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete drive image", err);
    res.status(500).json({ error: "failed to delete image" });
  }
});

app.delete("/api/boards/:boardId/drive/folders/:folderId", (req, res) => {
  try {
    const root = getBoardDriveRoot(req.params.boardId);
    if (!root || !isDriveFolderInBoard(req.params.boardId, req.params.folderId)) {
      return res.status(404).json({ error: "folder not found" });
    }
    const deleted = deleteDriveFolder(req.params.folderId);
    if (!deleted) return res.status(404).json({ error: "folder not found" });
    deleted.images.forEach((image) => {
      if (!image.source_image_id) removeDriveUpload(image.src);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete drive folder", err);
    res.status(500).json({ error: "failed to delete folder" });
  }
});

// ボードに紐づくユーザー一覧取得
app.get("/api/boards/:boardId/users", (req, res) => {
  const boardId = req.params.boardId;
  if (!boardId) return res.status(400).json([]);
  try {
    const users = getBoardUsers(boardId) || [];
    res.json(users);
  } catch (err) {
    console.error("Failed to fetch board users", err);
    res.status(500).json([]);
  }
});

// ボードにユーザーを紐づける（存在しなければ作成）
app.post("/api/boards/:boardId/users", (req, res) => {
  const boardId = req.params.boardId;
  const name = (req.body?.name || "").trim();
  const favoriteColor = String(req.body?.favoriteColor || "").trim() || null;
  if (!boardId || !name) {
    return res.status(400).json({ error: "invalid params" });
  }
  try {
    addUser(name, favoriteColor);
    linkUserToBoard(boardId, name, favoriteColor);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to link user to board", err);
    res.status(500).json({ error: "failed" });
  }
});

function absolutizeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractMeta(html, url) {
  const pick = (...patterns) => {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1]
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
      }
    }
    return "";
  };
  const title = pick(
    /<meta\s+[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["'][^>]*>/i,
    /<title[^>]*>([^<]+)<\/title>/i
  );
  const description = pick(
    /<meta\s+[^>]*(?:property|name)=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  const image = absolutizeUrl(
    pick(
      /<meta\s+[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["'][^>]*>/i,
      /<meta\s+[^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i,
      /<meta\s+[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<link\s+[^>]*rel=["'][^"']*image_src[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,
      /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*image_src[^"']*["'][^>]*>/i
    ),
    url
  );
  let jsonLdImage = "";
  if (!image) {
    const scripts = html.match(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const script of scripts) {
      const body = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
      try {
        const data = JSON.parse(body);
        const stack = Array.isArray(data) ? [...data] : [data];
        while (stack.length) {
          const item = stack.shift();
          if (!item || typeof item !== "object") continue;
          if (item.image) {
            const candidate = Array.isArray(item.image) ? item.image[0] : item.image;
            jsonLdImage = typeof candidate === "string" ? candidate : candidate?.url || "";
            if (jsonLdImage) break;
          }
          Object.values(item).forEach((value) => {
            if (value && typeof value === "object") {
              if (Array.isArray(value)) stack.push(...value);
              else stack.push(value);
            }
          });
        }
      } catch {
        // ignore invalid JSON-LD
      }
      if (jsonLdImage) break;
    }
  }
  const favicon = absolutizeUrl(
    pick(
      /<link\s+[^>]*rel=["'][^"']*(?:apple-touch-icon|icon|shortcut icon)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,
      /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:apple-touch-icon|icon|shortcut icon)[^"']*["'][^>]*>/i
    ),
    url
  ) || absolutizeUrl("/favicon.ico", url);
  const siteName =
    pick(/<meta\s+[^>]*(?:property|name)=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    new URL(url).hostname;
  return { title: title || url, description, image: image || absolutizeUrl(jsonLdImage, url), favicon, siteName };
}

function getYouTubeVideoId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
  }
  return "";
}

async function getYouTubePreview(url) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: controller.signal,
      headers: { "user-agent": "WhiteboardLinkPreview/1.0" },
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      return {
        url,
        title: data.title || url,
        description: "",
        image: data.thumbnail_url || thumbnail,
        siteName: data.provider_name || "YouTube",
      };
    }
  } catch {
    // fall through to deterministic thumbnail
  }
  return { url, title: url, description: "", image: thumbnail, siteName: "YouTube" };
}

app.get("/api/link-preview", async (req, res) => {
  const url = String(req.query.url || "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "unsupported url" });
  }
  const youtubePreview = await getYouTubePreview(parsed.toString());
  if (youtubePreview) {
    return res.json(youtubePreview);
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "user-agent": "WhiteboardLinkPreview/1.0" },
    });
    clearTimeout(timeout);
    const html = await response.text();
    res.json({ url: parsed.toString(), ...extractMeta(html.slice(0, 300000), parsed.toString()) });
  } catch (err) {
    res.json({ url: parsed.toString(), title: parsed.toString(), description: "", image: "", siteName: parsed.hostname });
  }
});

app.get("/api/link-image", async (req, res) => {
  const url = String(req.query.url || "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).end();
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).end();
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "user-agent": "WhiteboardLinkPreview/1.0" },
    });
    clearTimeout(timeout);
    if (!response.ok) return res.status(502).end();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) return res.status(415).end();
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
});

// （今はまだ使わないけど、あとでフロントから呼ぶAPI）
// --- WebSocket (Socket.IO) ---
// 各ボードごとに簡易なメモリ上の状態を持つ
// { strokes:[], texts:[], images:[] }
const boardStates = new Map();
const boardScreenShares = new Map();
const boardPresence = new Map();

function getBoardPresence(boardId) {
  if (!boardPresence.has(boardId)) boardPresence.set(boardId, new Map());
  return boardPresence.get(boardId);
}

function getOnlineUsers(boardId) {
  const presence = boardPresence.get(boardId);
  if (!presence) return [];
  return Array.from(new Set(Array.from(presence.values()).map((entry) => entry.user).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function broadcastOnlineUsers(boardId) {
  if (!boardId) return;
  io.to(boardId).emit("presence:users", getOnlineUsers(boardId));
}

function getBoardScreenShares(boardId) {
  if (!boardScreenShares.has(boardId)) {
    boardScreenShares.set(boardId, new Map());
  }
  return boardScreenShares.get(boardId);
}

function stopSocketScreenShare(socket, boardId) {
  if (!boardId) return;
  const shares = boardScreenShares.get(boardId);
  if (!shares || !shares.delete(socket.id)) return;
  if (shares.size === 0) boardScreenShares.delete(boardId);
  socket.to(boardId).emit("screen-share:status", {
    socketId: socket.id,
    active: false,
  });
}

function upsertById(list, item) {
  if (!item?.id) return;
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.push(item);
  }
}

function removeAllById(list, id) {
  let removed = false;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.id === id) {
      list.splice(i, 1);
      removed = true;
    }
  }
  return removed;
}

function getItemsByType(state, type) {
  if (type === "stroke") return state.strokes;
  if (type === "text") return state.texts;
  if (type === "image") return state.images;
  if (type === "link") return state.links;
  return null;
}

function notifyPersistenceError(socket, action, err) {
  console.error(`Failed to ${action}`, err);
  socket.emit("error-message", "保存に失敗しました。再読み込み前にサーバのログとディスク容量を確認してください。");
}

function dedupeById(list) {
  const byId = new Map();
  list.forEach((item) => {
    if (item?.id) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

function ensureBoardState(boardId) {
  if (!boardStates.has(boardId)) {
    const dbState = getBoardState(boardId);
    const images = (dbState.images || []).map((img) => {
      const materialized = materializeImageSrc(boardId, img);
      if (materialized.src !== img.src) {
        saveImage({ ...materialized, board_id: boardId });
      }
      return materialized;
    });
    boardStates.set(boardId, {
      title: dbState.title || boardId,
      strokes: (dbState.strokes || []).map((s) => ({ ...s, layer: s.layer || "user" })),
      texts: (dbState.texts || []).map((t) => ({ ...t, layer: t.layer || "user" })),
      images,
      links: dbState.links || [],
    });
  }
  return boardStates.get(boardId);
}

io.on("connection", (socket) => {
  let currentBoardId = null;
  let currentUserName = null;

  socket.on("join", ({ boardId }) => {
    const board = getBoard(boardId);
    if (!board) {
      socket.emit("error-message", "Board not found");
      return;
    }
    currentBoardId = boardId;
    socket.join(boardId);
    const state = ensureBoardState(boardId);
    state.strokes = dedupeById(state.strokes);
    state.texts = dedupeById(state.texts);
    state.images = dedupeById(state.images);
    state.links = dedupeById(state.links);
    socket.emit("init", state);
    const shares = boardScreenShares.get(boardId);
    const activeShares = shares ? Array.from(shares.entries()).map(([socketId, info]) => ({
      socketId,
      user: info.user || "",
    })) : [];
    socket.emit("screen-share:active", activeShares);
    socket.emit("presence:users", getOnlineUsers(boardId));
    const views = Array.from(getBoardPresence(boardId).values())
      .filter((entry) => entry.user && entry.view)
      .map((entry) => ({ user: entry.user, ...entry.view }));
    socket.emit("presence:views", views);
  });

  socket.on("user:identify", ({ boardId, user, favoriteColor, presence = true }) => {
    if (!boardId || !user) return;
    currentBoardId = boardId;
    currentUserName = user;
    addUser(user, favoriteColor || null);
    linkUserToBoard(boardId, user, favoriteColor || null);
    if (presence) {
      getBoardPresence(boardId).set(socket.id, { user, view: null });
      broadcastOnlineUsers(boardId);
    }
    const drafts = getDraftStrokes(boardId, user);
    socket.emit("draft:init", drafts);
  });

  socket.on("stroke:add", ({ boardId, stroke }, ack) => {
    if (boardId !== currentBoardId) {
      if (typeof ack === "function") ack({ ok: false, error: "board mismatch" });
      return;
    }
    try {
      saveStroke({ ...stroke, board_id: boardId });
      const state = ensureBoardState(boardId);
      upsertById(state.strokes, stroke);
      socket.to(boardId).emit("stroke:add", stroke);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      notifyPersistenceError(socket, "save stroke", err);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("text:add", ({ boardId, text }, ack) => {
    if (boardId !== currentBoardId) {
      if (typeof ack === "function") ack({ ok: false, error: "board mismatch" });
      return;
    }
    const t = text.createdAt ? text : { ...text, createdAt: Date.now() };
    try {
      saveText({ ...t, board_id: boardId });
      const state = ensureBoardState(boardId);
      upsertById(state.texts, t);
      socket.to(boardId).emit("text:add", t);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      notifyPersistenceError(socket, "save text", err);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("image:add", ({ boardId, image }, ack) => {
    if (boardId !== currentBoardId) {
      if (typeof ack === "function") ack({ ok: false, error: "board mismatch" });
      return;
    }
    try {
      const storedImage = materializeImageSrc(boardId, image);
      saveImage({ ...storedImage, board_id: boardId });
      const state = ensureBoardState(boardId);
      upsertById(state.images, storedImage);
      socket.to(boardId).emit("image:add", storedImage);
      if (typeof ack === "function") ack({ ok: true, image: storedImage });
    } catch (err) {
      notifyPersistenceError(socket, "save image", err);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("link:add", ({ boardId, link }, ack) => {
    if (boardId !== currentBoardId) {
      if (typeof ack === "function") ack({ ok: false, error: "board mismatch" });
      return;
    }
    const l = link.createdAt ? link : { ...link, createdAt: Date.now() };
    try {
      saveLink({ ...l, board_id: boardId });
      const state = ensureBoardState(boardId);
      upsertById(state.links, l);
      socket.to(boardId).emit("link:add", l);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      notifyPersistenceError(socket, "save link", err);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("item:update", ({ boardId, type, id, patch }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const list = getItemsByType(state, type);
    if (!list) return;
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], ...patch };
      try {
        if (type === "stroke") {
          saveStroke({ ...updated, board_id: boardId });
        } else if (type === "text") {
          saveText({ ...updated, board_id: boardId });
        } else if (type === "image") {
          const storedImage = materializeImageSrc(boardId, updated);
          if (storedImage.src !== updated.src) {
            patch = { ...patch, src: storedImage.src };
          }
          Object.assign(updated, storedImage);
          saveImage({ ...updated, board_id: boardId });
        } else if (type === "link") {
          saveLink({ ...updated, board_id: boardId });
        }
        list[idx] = updated;
        socket.to(boardId).emit("item:update", { type, id, patch });
      } catch (err) {
        notifyPersistenceError(socket, `update ${type}`, err);
      }
    }
  });

  socket.on("item:remove", ({ boardId, type, id }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const list = getItemsByType(state, type);
    if (!list) return;
    const removedItem = list.find((item) => item?.id === id);
    if (removedItem) {
      try {
        if (type === "stroke") deleteStroke(boardId, id);
        else if (type === "text") deleteText(boardId, id);
        else if (type === "image") {
          if (removedItem.draftBoardSource && currentUserName) {
            deleteDraftBoardContents(boardId, id, currentUserName);
            [
              ["text", state.texts],
              ["image", state.images],
            ].forEach(([childType, childList]) => {
              childList
                .filter((child) => child?.draftBoardId === id && child.user === currentUserName)
                .forEach((child) => {
                  removeAllById(childList, child.id);
                  io.to(boardId).emit("item:remove", { type: childType, id: child.id });
                });
            });
          }
          deleteImage(boardId, id);
        }
        else if (type === "link") deleteLink(boardId, id);
        if (removeAllById(list, id)) {
          socket.to(boardId).emit("item:remove", { type, id });
        }
      } catch (err) {
        notifyPersistenceError(socket, `remove ${type}`, err);
      }
    }
  });

  socket.on("board:title:update", ({ boardId, title }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    state.title = title || boardId;
    setBoardTitle(boardId, state.title);
    socket.to(boardId).emit("board:title:update", { title: state.title });
  });

  // 注目（レーザーポインター）
  socket.on("attention:start", ({ boardId, data }) => {
    if (boardId !== currentBoardId) return;
    socket.to(boardId).emit("attention:start", data);
  });

  socket.on("attention:update", ({ boardId, data }) => {
    if (boardId !== currentBoardId) return;
    socket.to(boardId).emit("attention:update", data);
  });

  socket.on("attention:end", ({ boardId, user }) => {
    if (boardId !== currentBoardId) return;
    socket.to(boardId).emit("attention:end", { user });
  });

  socket.on("presence:view", ({ boardId, view }) => {
    if (boardId !== currentBoardId || !currentUserName || !view) return;
    if (![view.x, view.y, view.scale, view.width, view.height].every(Number.isFinite)) return;
    if (view.width <= 0 || view.height <= 0) return;
    const safeView = {
      x: view.x,
      y: view.y,
      scale: Math.min(4, Math.max(0.05, view.scale)),
      width: view.width,
      height: view.height,
    };
    const presence = getBoardPresence(boardId);
    presence.set(socket.id, { user: currentUserName, view: safeView });
    socket.to(boardId).emit("presence:view", { user: currentUserName, ...safeView });
  });

  socket.on("presence:writing:start", ({ boardId, data }) => {
    if (boardId !== currentBoardId || !data) return;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    socket.to(boardId).emit("presence:writing:start", {
      socketId: socket.id,
      user: currentUserName || data.user || "",
      x: data.x,
      y: data.y,
    });
  });

  socket.on("presence:writing:update", ({ boardId, data }) => {
    if (boardId !== currentBoardId || !data) return;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    socket.to(boardId).emit("presence:writing:update", {
      socketId: socket.id,
      user: currentUserName || data.user || "",
      x: data.x,
      y: data.y,
    });
  });

  socket.on("presence:writing:end", ({ boardId }) => {
    if (boardId !== currentBoardId) return;
    socket.to(boardId).emit("presence:writing:end", {
      socketId: socket.id,
      user: currentUserName || "",
    });
  });

  socket.on("screen-share:status", ({ boardId, active, user }) => {
    if (boardId !== currentBoardId) return;
    if (active) {
      getBoardScreenShares(boardId).set(socket.id, {
        user: user || currentUserName || "",
      });
    } else {
      stopSocketScreenShare(socket, boardId);
      return;
    }
    socket.to(boardId).emit("screen-share:status", {
      socketId: socket.id,
      user: user || currentUserName || "",
      active: true,
    });
  });

  socket.on("screen-share:signal", ({ boardId, to, data }) => {
    if (boardId !== currentBoardId || !to || !data) return;
    io.to(to).emit("screen-share:signal", {
      from: socket.id,
      user: currentUserName || "",
      data,
    });
  });

  // --- Draft strokes (private) ---
  socket.on("draft:stroke:add", ({ boardId, stroke }) => {
    if (boardId !== currentBoardId) return;
    if (!stroke || !currentUserName) return;
    saveDraftStroke({ ...stroke, board_id: boardId, user: currentUserName });
  });

  socket.on("draft:stroke:remove", ({ boardId, id }) => {
    if (boardId !== currentBoardId) return;
    if (!id || !currentUserName) return;
    deleteDraftStroke(boardId, id, currentUserName);
  });

  socket.on("disconnect", () => {
    stopSocketScreenShare(socket, currentBoardId);
    if (currentBoardId) {
      const presence = boardPresence.get(currentBoardId);
      if (presence) {
        presence.delete(socket.id);
        if (presence.size === 0) boardPresence.delete(currentBoardId);
      }
      broadcastOnlineUsers(currentBoardId);
      socket.to(currentBoardId).emit("presence:writing:end", {
        socketId: socket.id,
        user: currentUserName || "",
      });
    }
    currentBoardId = null;
  });
});

// サーバ起動
server.listen(PORT, HOST, () => {
  console.log(`Whiteboard server running on ${protocol}://${HOST}:${PORT}`);
});
