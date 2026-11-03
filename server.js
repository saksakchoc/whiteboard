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
  requestPublicBaseUrl,
  absolutizeSpecValue,
} = require("./lib/design-spec-links");

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
  saveDesignItem,
  deleteDesignItem,
  getDesignItems,
} = require("./db");

// 設定
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "";
const SSL_CA_PATH = process.env.SSL_CA_PATH || "";
const APP_BASE_PATH = `/${String(process.env.APP_BASE_PATH || "whiteboard")
  .replace(/^\/+|\/+$/g, "")}`;
const dataDir = path.join(__dirname, "data");

const rootApp = express();
const app = express.Router();

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

const { server, protocol } = createHttpServer(rootApp);
const io = new Server(server, {
  path: `${APP_BASE_PATH}/socket.io`,
  maxHttpBufferSize: Number(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || 50 * 1024 * 1024),
});

rootApp.use(APP_BASE_PATH, app);

// JSON / 静的ファイル
app.use(express.json());
app.get("/vendor/jsQR.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "jsqr", "dist", "jsQR.js"));
});
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// アップロード先（まだ使わないけど作っておく）
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// multer 設定（ここも後で使う）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const boardId = safeFilePart(req.params.boardId || "common", "common");
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
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const extensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"]);
    const mimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp", "image/avif"]);
    const extensionMatches = extensions.has(path.extname(file.originalname || "").toLowerCase());
    const isImage = mimeTypes.has(String(file.mimetype || "").toLowerCase()) ||
      (file.mimetype === "application/octet-stream" && extensionMatches);
    cb(isImage ? null : new Error("images only"), isImage);
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

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

function appUrl(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return value;
  if (value === APP_BASE_PATH || value.startsWith(`${APP_BASE_PATH}/`)) return value;
  return `${APP_BASE_PATH}${value}`;
}

function publicImage(image) {
  if (!image || typeof image !== "object") return image;
  return {
    ...image,
    src: appUrl(image.src),
    slideshowSlides: Array.isArray(image.slideshowSlides)
      ? image.slideshowSlides.map((slide) => (
          typeof slide === "string"
            ? appUrl(slide)
            : { ...slide, src: appUrl(slide?.src) }
        ))
      : image.slideshowSlides,
  };
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
    src: appUrl(`/uploads/${safeFilePart(boardId, "board")}/${filename}`),
  };
}

function materializeBoardImage(boardId, image) {
  if (!image || !Array.isArray(image.slideshowSlides) || !image.slideshowSlides.length) {
    return materializeImageSrc(boardId, image);
  }
  const slides = image.slideshowSlides.slice(0, 500).map((slide, index) => {
    const normalized = typeof slide === "string" ? { src: slide, name: "" } : slide || {};
    const stored = materializeImageSrc(boardId, {
      id: `${image.id}_slide_${index + 1}`,
      src: String(normalized.src || ""),
    });
    return {
      src: stored.src,
      name: String(normalized.name || ""),
      zoom: Math.max(0.25, Math.min(Number(normalized.zoom) || 1, 8)),
      panX: Math.max(-1, Math.min(Number(normalized.panX) || 0, 1)),
      panY: Math.max(-1, Math.min(Number(normalized.panY) || 0, 1)),
      driveImageId: normalized.driveImageId ? String(normalized.driveImageId) : undefined,
    };
  }).filter((slide) => slide.src);
  const slideshowIndex = Math.max(0, Math.min(Number(image.slideshowIndex) || 0, slides.length - 1));
  return materializeImageSrc(boardId, {
    ...image,
    slideshowSlides: slides,
    slideshowIndex,
    src: slides[slideshowIndex]?.src || image.src,
  });
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

// ルートは既存ホワイトボード側へ。画面設計は /d/ で完全に分離する。
app.get("/", (_req, res) => {
  res.redirect(appUrl("/b/"));
});

app.get("/b", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/d", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "design-index.html"));
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

function createNewBoardId(req, mode = "whiteboard") {
  let id;
  do {
    id = generateBoardId();
  } while (getBoard(id)); // かぶり防止

  createBoard(id, mode);
  logBoardCreation(req, id);
  return id;
}

// 新しいボードを作成してリダイレクト
app.post("/new", (req, res) => {
  const id = createNewBoardId(req);
  res.redirect(appUrl(`/b/${id}`));
});

app.post("/api/boards", (req, res) => {
  try {
    const mode = req.body?.mode === "design" ? "design" : "whiteboard";
    const id = createNewBoardId(req, mode);
    res.status(201).json({ id, mode, url: appUrl(`/${mode === "design" ? "d" : "b"}/${id}`) });
  } catch (err) {
    console.error("Failed to create board", err);
    res.status(500).json({ error: "failed to create board" });
  }
});

app.get("/new", (req, res) => {
  res.redirect(appUrl("/b/"));
});

app.get("/api/boards", (req, res) => {
  try {
    const mode = req.query.mode === "design" || req.query.mode === "whiteboard" ? req.query.mode : null;
    res.json(
      listBoards(mode).map((board) => ({
        id: board.id,
        mode: board.mode || "whiteboard",
        title: board.title || board.id,
        createdAt: board.created_at,
        counts: {
          strokes: board.stroke_count || 0,
          texts: board.text_count || 0,
          images: board.image_count || 0,
          links: board.link_count || 0,
          designItems: board.design_item_count || 0,
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
  if (!board || board.mode === "design") {
    return res.status(404).send("Board not found");
  }
  res.sendFile(path.join(__dirname, "public", "board.html"));
});

// 画面設計モード（元のホワイトボードとは別画面・同じ共同編集基盤）
app.get("/d/:boardId", (req, res) => {
  const board = getBoard(req.params.boardId);
  if (!board || board.mode !== "design") return res.status(404).send("Board not found");
  res.sendFile(path.join(__dirname, "public", "design.html"));
});

app.post("/api/boards/:boardId/design-image", (req, res) => {
  const board = getBoard(req.params.boardId);
  if (!board || board.mode !== "design") return res.status(404).json({ error: "board not found" });
  upload.single("image")(req, res, (uploadError) => {
    if (uploadError) return res.status(400).json({ error: uploadError.message || "upload failed" });
    if (!req.file) return res.status(400).json({ error: "image is required" });
    const boardPart = safeFilePart(req.params.boardId, "board");
    res.json({
      ok: true,
      src: appUrl(`/uploads/${boardPart}/${path.basename(req.file.filename)}`),
      name: req.file.originalname,
    });
  });
});

function normalizeDesignItem(boardId, raw, user = "") {
  if (!raw || typeof raw !== "object") throw new Error("invalid design item");
  const allowedKinds = new Set(["screen", "component", "transition", "note", "decision"]);
  const kind = String(raw.kind || "");
  if (!allowedKinds.has(kind)) throw new Error("invalid design item kind");
  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : {};
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > 64 * 1024) throw new Error("design item is too large");
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  return {
    id: String(raw.id || crypto.randomUUID()).slice(0, 120),
    boardId,
    kind,
    x: clamp(raw.x, -100000, 100000, 0),
    y: clamp(raw.y, -100000, 100000, 0),
    width: clamp(raw.width, 40, 5000, kind === "screen" ? 360 : 240),
    height: clamp(raw.height, 28, 5000, kind === "screen" ? 640 : 140),
    zIndex: Math.round(clamp(raw.zIndex, -100000, 100000, 0)),
    data,
    createdBy: String(raw.createdBy || user || "").slice(0, 80),
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

function buildDesignSpec(boardId, publicBaseUrl) {
  const board = getBoard(boardId);
  if (!board) return null;
  const items = getDesignItems(boardId).map((item) => absolutizeSpecValue(item, publicBaseUrl));
  const byKind = (kind) => items.filter((item) => item.kind === kind);
  return {
    schemaVersion: "1.0",
    board: {
      id: boardId,
      title: getBoardTitle(boardId) || boardId,
      url: `${publicBaseUrl}/d/${encodeURIComponent(boardId)}`,
    },
    generatedAt: new Date().toISOString(),
    screens: byKind("screen"),
    components: byKind("component"),
    transitions: byKind("transition"),
    interactionNotes: byKind("note"),
    decisions: byKind("decision"),
  };
}

function designSpecMarkdown(spec) {
  const line = (value) => String(value || "").replace(/\r?\n/g, " ").trim();
  const menuDirection = (item) => {
    const requested = item.data?.menuDirection || "auto";
    if (requested === "horizontal" || requested === "vertical") return requested;
    const count = Math.max(1, Array.isArray(item.data?.menuItems) ? item.data.menuItems.length : 1);
    return item.width >= item.height * 1.35 && item.width / count >= 72 ? "horizontal" : "vertical";
  };
  const out = [`# ${line(spec.board.title)} — 画面仕様`, "", `Board ID: \`${spec.board.id}\``, ""];
  out.push("## 画面", "");
  for (const screen of spec.screens) {
    const d = screen.data || {};
    out.push(`### ${line(d.name) || "名称未設定"}`, "", `- ID: \`${screen.id}\``);
    if (d.description) out.push(`- 目的: ${line(d.description)}`);
    const children = spec.components.filter((item) => item.data?.screenId === screen.id);
    if (children.length) {
      out.push("- 要素:");
      children.forEach((item) => {
        const linkTarget = spec.screens.find((candidate) => candidate.id === item.data?.linkScreenId)?.data?.name;
        out.push(`  - ${line(item.data?.componentType) || "要素"}: ${line(item.data?.name) || "名称未設定"}${item.data?.componentType === "text" ? ` — 表示文言: ${line(item.data?.textContent ?? "ここにテキストが入ります")}` : ""}${item.data?.color ? ` — 背景色: ${line(item.data.color)}` : ""}${item.data?.imageSrc ? ` — 画像: ${line(item.data.imageSrc)}` : ""}${linkTarget ? ` — リンク先: ${line(linkTarget)}` : ""}${item.data?.linkNote ? ` — リンク補足: ${line(item.data.linkNote)}` : ""}${item.data?.behavior ? ` — 動作: ${line(item.data.behavior)}` : ""}${item.data?.memo ? ` — メモ: ${line(item.data.memo)}` : ""}`);
        if (item.data?.componentType === "menu" && Array.isArray(item.data?.menuItems)) {
          out.push(`    - 並び方: ${menuDirection(item) === "horizontal" ? "横並び" : "縦並び"}${(item.data?.menuDirection || "auto") === "auto" ? "（自動）" : ""}`);
          item.data.menuItems.forEach((menuItem) => {
            const menuTarget = spec.screens.find((candidate) => candidate.id === menuItem.linkScreenId)?.data?.name;
            out.push(`    - メニュー項目: ${line(menuItem.label) || "名称未設定"}${menuTarget ? ` → ${line(menuTarget)}` : " — リンク未設定"}${menuItem.note ? `（${line(menuItem.note)}）` : ""}`);
          });
        }
      });
    }
    out.push("");
  }
  out.push("## 画面遷移", "");
  for (const item of spec.transitions) {
    const d = item.data || {};
    const from = spec.screens.find((screen) => screen.id === d.fromScreenId)?.data?.name || d.fromScreenId || "未設定";
    const to = spec.screens.find((screen) => screen.id === d.toScreenId)?.data?.name || d.toScreenId || "未設定";
    out.push(`- ${line(from)} → ${line(to)}：${line(d.trigger) || "操作未設定"}${d.condition ? `（条件: ${line(d.condition)}）` : ""}`);
  }
  out.push("", "## メモ", "");
  spec.interactionNotes.forEach((item) => {
    const target = [...spec.screens, ...spec.components].find((candidate) => candidate.id === item.data?.relatedItemId);
    const targetName = target?.data?.name || "";
    const title = line(item.data?.title);
    out.push(`- ${title ? `${title}${targetName ? `（対象: ${line(targetName)}）` : ""}: ` : targetName ? `対象: ${line(targetName)} — ` : ""}${line(item.data?.body)}`);
  });
  out.push("", "## 案", "");
  spec.decisions.forEach((item) => {
    const d = item.data || {};
    const options = Array.isArray(d.options) ? d.options.filter(Boolean).join(" / ") : "";
    const detail = d.status === "decided" ? ` — 決定事項: ${line(d.resolution) || "未入力"}` : options ? `（候補: ${line(options)}）` : "";
    const title = line(d.question);
    const content = title ? `${title}${detail}` : detail.replace(/^ — /, "");
    out.push(`- [${d.status === "decided" ? "x" : " "}]${content ? ` ${content}` : ""}`);
  });
  out.push("");
  return out.join("\n");
}

function designPreviewHtml(spec) {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const textColorFor = (background) => {
    const match = String(background || "").match(/^#([0-9a-f]{6})$/i);
    if (!match) return "#172033";
    const value = Number.parseInt(match[1], 16);
    return (((value >> 16) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000) < 145 ? "#fff" : "#172033";
  };
  const menuDirectionFor = (item) => {
    const requested = item.data?.menuDirection || "auto";
    if (requested === "horizontal" || requested === "vertical") return requested;
    const count = Math.max(1, Array.isArray(item.data?.menuItems) ? item.data.menuItems.length : 1);
    return item.width >= item.height * 1.35 && item.width / count >= 72 ? "horizontal" : "vertical";
  };
  const items = [...spec.screens, ...spec.components, ...spec.interactionNotes, ...spec.decisions];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const calloutBounds = [];
  const addCalloutBound = (item, type, defaultY) => {
    const saved = item.data?.calloutPositions?.[type];
    calloutBounds.push({
      x: item.x + (Number.isFinite(saved?.x) ? saved.x : item.width + 68),
      y: item.y + (Number.isFinite(saved?.y) ? saved.y : defaultY),
      width: 220,
      height: 96,
    });
  };
  spec.components.forEach((item) => {
    if (item.data?.behavior) addCalloutBound(item, "behavior", -8);
    if (item.data?.memo) addCalloutBound(item, "memo", item.data?.behavior ? 70 : -8);
  });
  spec.screens.forEach((item) => { if (item.data?.description) addCalloutBound(item, "description", 56); });
  const allBounds = [...items, ...calloutBounds];
  const minX = Math.min(0, ...allBounds.map((item) => item.x || 0)) - 80;
  const minY = Math.min(0, ...allBounds.map((item) => item.y || 0)) - 80;
  const maxX = Math.max(1200, ...allBounds.map((item) => (item.x || 0) + (item.width || 0))) + 80;
  const maxY = Math.max(800, ...allBounds.map((item) => (item.y || 0) + (item.height || 0))) + 80;
  const ox = -minX;
  const oy = -minY;
  const screenById = new Map(spec.screens.map((screen) => [screen.id, screen]));
  const transitions = spec.transitions.map((item) => {
    const from = screenById.get(item.data?.fromScreenId);
    const to = screenById.get(item.data?.toScreenId);
    if (!from || !to) return "";
    const x1 = from.x + from.width + ox;
    const y1 = from.y + Math.min(from.height / 2, 180) + oy;
    const x2 = to.x + ox;
    const y2 = to.y + Math.min(to.height / 2, 180) + oy;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }).join("");
  const transitionLabels = spec.transitions.map((item) => {
    const from = screenById.get(item.data?.fromScreenId);
    const to = screenById.get(item.data?.toScreenId);
    if (!from || !to) return "";
    const x1 = from.x + from.width + ox;
    const y1 = from.y + Math.min(from.height / 2, 180) + oy;
    const x2 = to.x + ox;
    const y2 = to.y + Math.min(to.height / 2, 180) + oy;
    return `<span class="transition-label" style="left:${(x1 + x2) / 2}px;top:${(y1 + y2) / 2}px">${esc(item.data?.trigger || "操作未設定")}</span>`;
  }).join("");
  const componentLinks = spec.components.map((item) => {
    const target = screenById.get(item.data?.linkScreenId);
    if (!target) return null;
    if (target.id === item.data?.screenId) {
      return { self: true, x: item.x + item.width / 2 + ox, y: item.y - 12 + oy, label: target.data?.name || "現在の画面", note: item.data?.linkNote || "" };
    }
    const toRight = target.x + target.width / 2 >= item.x + item.width / 2;
    const x1 = (toRight ? item.x + item.width : item.x) + ox;
    const y1 = item.y + item.height / 2 + oy;
    const x2 = (toRight ? target.x : target.x + target.width) + ox;
    const y2 = target.y + Math.min(target.height / 2, 180) + oy;
    return { self: false, x1, y1, x2, y2, label: target.data?.name || "リンク先画面", note: item.data?.linkNote || "" };
  }).filter(Boolean);
  const componentLinkLines = componentLinks.filter((link) => !link.self).map((link) => `<line class="link-line" x1="${link.x1}" y1="${link.y1}" x2="${link.x2}" y2="${link.y2}"/>`).join("");
  const rectangleEdgePoint = (from, toward) => {
    const centerX = from.x + from.width / 2;
    const centerY = from.y + from.height / 2;
    const dx = toward.x + toward.width / 2 - centerX;
    const dy = toward.y + toward.height / 2 - centerY;
    if (!dx && !dy) return { x: centerX, y: centerY };
    const horizontal = Math.abs(dx) > 0 ? (from.width / 2) / Math.abs(dx) : Infinity;
    const vertical = Math.abs(dy) > 0 ? (from.height / 2) / Math.abs(dy) : Infinity;
    const factor = Math.min(horizontal, vertical);
    return { x: centerX + dx * factor, y: centerY + dy * factor };
  };
  const relationLinkLines = [...spec.decisions, ...spec.interactionNotes].map((item) => {
    const target = itemById.get(item.data?.relatedItemId);
    if (!target || target.id === item.id) return "";
    const start = rectangleEdgePoint(item, target);
    const end = rectangleEdgePoint(target, item);
    return `<line class="${item.kind}-link-line" x1="${start.x + ox}" y1="${start.y + oy}" x2="${end.x + ox}" y2="${end.y + oy}"/>`;
  }).join("");
  const linkLabel = (link, arrow, left, top, extraClass = "") => {
    const noteStyle = link.note ? ";white-space:normal;text-align:left;min-width:180px;max-width:260px;border-radius:10px" : "";
    const content = link.note
      ? `<strong style="display:block">${arrow} ${esc(link.label)}</strong><small style="display:block;margin-top:3px;white-space:pre-wrap">${esc(link.note)}</small>`
      : `${arrow} ${esc(link.label)}`;
    return `<span class="link-label${extraClass}" style="left:${left}px;top:${top}px${noteStyle}">${content}</span>`;
  };
  const componentLinkLabels = componentLinks.map((link) => link.self
    ? linkLabel(link, "↺", link.x, link.y, " self-link-label")
    : linkLabel(link, "→", (link.x1 + link.x2) / 2, (link.y1 + link.y2) / 2)).join("");
  const itemHtml = items.map((item) => {
    const d = item.data || {};
    const style = `left:${item.x + ox}px;top:${item.y + oy}px;width:${item.width}px;height:${item.height}px`;
    if (item.kind === "screen") return `<section class="item screen" style="${style}"><header>${esc(d.name || "名称未設定")}</header><div class="screen-body"></div></section>`;
    if (item.kind === "component") {
      const colorStyle = /^#[0-9a-f]{6}$/i.test(String(d.color || "")) ? `;background-color:${d.color};color:${textColorFor(d.color)}` : "";
      let content;
      if (d.componentType === "menu") {
        const entries = (Array.isArray(d.menuItems) ? d.menuItems : []).map((menuItem) => {
          const target = screenById.get(menuItem.linkScreenId);
          const targetText = target ? `→ ${target.data?.name || "リンク先画面"}` : "リンク未設定";
          return `<span class="menu-entry"><b>${esc(menuItem.label || "名称未設定")}</b><small>${esc(targetText)}</small>${menuItem.note ? `<em>${esc(menuItem.note)}</em>` : ""}</span>`;
        }).join("");
        content = `<strong class="menu-title">${esc(d.name || "メニュー")}</strong><span class="menu-list">${entries || '<span class="menu-empty">項目未設定</span>'}</span>`;
      } else {
        content = d.componentType === "image" && d.imageSrc
          ? `<img src="${esc(d.imageSrc)}" alt="${esc(d.name || "画像")}">`
          : esc(d.componentType === "text" ? (d.textContent ?? "ここにテキストが入ります") : (d.name || d.componentType || "UI部品"));
      }
      const menuClass = d.componentType === "menu" ? ` menu-${menuDirectionFor(item)}` : "";
      return `<div class="item component type-${esc(d.componentType || "button")}${menuClass}" style="${style}${colorStyle}">${content}</div>`;
    }
    if (item.kind === "note") {
      const title = String(d.title || "").trim();
      return `<aside class="item note" style="${style}">${title ? `<strong>メモ: ${esc(title)}</strong>` : ""}<p>${esc(d.body || "")}</p></aside>`;
    }
    const title = String(d.question || "").trim();
    const detail = d.status === "decided"
      ? `<p class="decision-resolution"><b>決定事項</b>${esc(d.resolution || "未入力")}</p>`
      : `<p>${esc((d.options || []).join(" / "))}</p>`;
    return `<aside class="item decision ${d.status === "decided" ? "decided" : ""}" style="${style}">${title ? `<strong>${esc(title)}</strong>` : ""}${detail}</aside>`;
  }).join("");
  const callouts = spec.components.flatMap((item) => {
    const result = [];
    if (item.data?.behavior) result.push({ item, type: "behavior", label: "操作時の動作", text: item.data.behavior, defaultY: -8 });
    if (item.data?.memo) result.push({ item, type: "memo", label: "補足メモ", text: item.data.memo, defaultY: item.data?.behavior ? 70 : -8 });
    return result;
  }).concat(spec.screens.filter((item) => item.data?.description).map((item) => ({
    item, type: "description", label: "画面の説明", text: item.data.description, defaultY: 56,
  })));
  const calloutPosition = (item, type, defaultY) => {
    const saved = item.data?.calloutPositions?.[type];
    return {
      x: item.x + (Number.isFinite(saved?.x) ? saved.x : item.width + 68) + ox,
      y: item.y + (Number.isFinite(saved?.y) ? saved.y : defaultY) + oy,
    };
  };
  const calloutLines = callouts.map(({ item, type, defaultY }) => {
    const position = calloutPosition(item, type, defaultY);
    const x1 = item.x + item.width + ox;
    const y1 = item.y + (type === "description" ? 80 : item.height / 2) + oy;
    return `<line class="${type === "description" ? "description-line" : `behavior-line ${type}-line`}" x1="${x1}" y1="${y1}" x2="${position.x}" y2="${position.y + 24}"/>`;
  }).join("");
  const calloutCards = callouts.map(({ item, type, label, text, defaultY }) => {
    const position = calloutPosition(item, type, defaultY);
    return `<aside class="behavior ${type}" style="left:${position.x}px;top:${position.y}px"><small>${label}</small>${esc(text)}</aside>`;
  }).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.board.title)} — 画面仕様</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#172033;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif}header.page{position:sticky;top:0;z-index:100;background:#111827;color:#fff;padding:16px 24px;box-shadow:0 3px 15px #0003}header.page h1{font-size:18px;margin:0}header.page p{color:#aab4c5;font-size:12px;margin:4px 0 0}.viewport{overflow:auto;padding:24px}.canvas{position:relative;width:${maxX - minX}px;height:${maxY - minY}px;background-color:#f8f9fc;background-image:linear-gradient(#d8deea80 1px,transparent 1px),linear-gradient(90deg,#d8deea80 1px,transparent 1px);background-size:24px 24px;border:1px solid #d7dce6;box-shadow:0 15px 40px #3440541a}.lines{position:absolute;inset:0;z-index:70;pointer-events:none}.lines line{stroke:#7c3aed;stroke-width:2.5;marker-end:url(#arrow)}.lines .behavior-line{stroke:#e07a00;stroke-dasharray:5 4;marker-end:none}.lines .memo-line{stroke:#2563eb}.lines .description-line{stroke:#7c3aed;stroke-dasharray:3 4;marker-end:none}.lines .link-line{stroke:#0f766e;stroke-dasharray:7 4;marker-end:url(#link-arrow)}.item{position:absolute}.screen{z-index:10;background:#fff;border:2px solid #344054;border-radius:16px;overflow:hidden;box-shadow:0 12px 28px #1f29371a}.screen>header{height:48px;background:#f1f3f7;border-bottom:1px solid #d0d5dd;padding:0 14px;display:flex;align-items:center;font-weight:700}.screen-body{height:calc(100% - 48px)}.component{z-index:30;display:grid;place-items:center;padding:4px 8px;line-height:1.2;background:#fff;border:1.5px solid #667085;border-radius:8px;box-shadow:0 2px 5px #10182814}.type-button{background:#344054;color:#fff}.type-input,.type-dropdown{justify-items:start;color:#667085}.type-text{justify-items:start;align-content:start;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;border-color:transparent;box-shadow:none}.type-dropdown:after{content:'⌄';position:absolute;right:10px}.type-list{background:repeating-linear-gradient(#fff 0 27px,#d0d5dd 28px)}.type-image{padding:0;overflow:hidden;background:linear-gradient(135deg,#eef2f7 50%,#e0e7ef 50%)}.type-image img{display:block;width:100%;height:100%;object-fit:cover}.type-box{background:#fff;border-style:dashed}.type-header,.type-footer{background:#dbe4f0;font-weight:700}.type-sidebar,.type-sidebar-left,.type-sidebar-right{background:#e7ebf2;justify-items:start}.type-menu{display:block;padding:8px;background:#f8fafc;overflow:hidden}.menu-title{display:block;margin:0 2px 6px;font-size:11px;opacity:.68}.menu-list{display:grid;gap:5px}.menu-horizontal .menu-list{grid-auto-flow:column;grid-auto-columns:minmax(72px,1fr)}.menu-vertical .menu-list{grid-auto-flow:row}.menu-entry{display:block;padding:6px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff}.menu-entry b,.menu-entry small,.menu-entry em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.menu-entry b{font-size:11px}.menu-entry small{margin-top:2px;color:#0f766e;font-size:9px}.menu-entry em{margin-top:2px;color:#667085;font-size:9px;font-style:normal}.menu-empty{display:block;padding:8px;border:1px dashed #cbd5e1;border-radius:6px;color:#98a2b3;font-size:10px;text-align:center}.note,.decision{z-index:40;padding:14px;border-radius:10px;box-shadow:0 8px 20px #1018281a;overflow:hidden}.note{background:#fff7cc;border:1px solid #efd96a}.decision{background:#fff;border:2px dashed #f79009}.note p,.decision p{white-space:pre-wrap;font-size:12px;line-height:1.5}.decision b{font-size:11px;color:#067647}.behavior{position:absolute;z-index:80;width:220px;min-height:54px;padding:10px 12px;background:#fff8e8;border:1px solid #f0a53a;border-radius:9px;box-shadow:0 7px 18px #b5470822;font-size:12px;line-height:1.45}.behavior small{display:block;color:#b54708;font-weight:800;margin-bottom:3px}.behavior.memo{background:#eff6ff;border-color:#60a5fa;color:#1e3a8a}.behavior.memo small{color:#1d4ed8}.behavior.description{background:#f3efff;border-color:#a78bfa;color:#4c1d95}.behavior.description small{color:#6d28d9}.transition-label{position:absolute;z-index:82;transform:translate(-50%,-50%);max-width:180px;padding:4px 8px;border:1px solid #c4b5fd;border-radius:999px;background:#fff;color:#5b21b6;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 7px #5b21b622}.link-label{position:absolute;z-index:81;transform:translate(-50%,-50%);max-width:190px;padding:4px 9px;border:1px solid #5eead4;border-radius:999px;background:#f0fdfa;color:#115e59;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.legend{padding:0 24px 24px;color:#667085;font-size:12px}
  .lines .decision-link-line{stroke:#f79009;stroke-width:2;stroke-dasharray:4 4;marker-end:url(#decision-arrow)}.lines .note-link-line{stroke:#2563eb;stroke-width:2;stroke-dasharray:4 4;marker-end:url(#note-arrow)}.decision-resolution{padding:8px 9px;border-radius:7px;background:#ecfdf3;color:#067647!important;font-weight:650}.decision-resolution b{display:block;margin-bottom:4px;font-size:10px}
  </style></head><body><header class="page"><h1>${esc(spec.board.title)} — 画面仕様プレビュー</h1><p>生成日時: ${esc(spec.generatedAt)} / Board ID: ${esc(spec.board.id)}</p></header><div class="viewport"><main class="canvas"><svg class="lines" width="${maxX - minX}" height="${maxY - minY}"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#7c3aed"/></marker><marker id="link-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#0f766e"/></marker><marker id="decision-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#f79009"/></marker><marker id="note-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#2563eb"/></marker></defs>${transitions}${componentLinkLines}${relationLinkLines}${calloutLines}</svg>${itemHtml}${transitionLabels}${componentLinkLabels}${calloutCards}</main></div><p class="legend">紫実線: 画面遷移 / 青緑点線: 部品のリンク / オレンジ点線: 案の関連 / 青点線: メモの関連 / 紫点線: 画面の説明 / オレンジ破線: 操作時の動作 / 青点線: 補足メモ</p></body></html>`;
}

app.get("/api/boards/:boardId/design-spec", (req, res) => {
  const publicBaseUrl = requestPublicBaseUrl(req, APP_BASE_PATH, process.env.PUBLIC_BASE_URL);
  const spec = buildDesignSpec(req.params.boardId, publicBaseUrl);
  if (!spec) return res.status(404).json({ error: "board not found" });
  res.setHeader("Content-Disposition", `attachment; filename=design-spec-${safeFilePart(req.params.boardId)}.json`);
  res.json(spec);
});

app.get("/api/boards/:boardId/design-spec.md", (req, res) => {
  const publicBaseUrl = requestPublicBaseUrl(req, APP_BASE_PATH, process.env.PUBLIC_BASE_URL);
  const spec = buildDesignSpec(req.params.boardId, publicBaseUrl);
  if (!spec) return res.status(404).send("Board not found");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=design-spec-${safeFilePart(req.params.boardId)}.md`);
  res.send(designSpecMarkdown(spec));
});

app.get("/api/boards/:boardId/design-preview.html", (req, res) => {
  const publicBaseUrl = requestPublicBaseUrl(req, APP_BASE_PATH, process.env.PUBLIC_BASE_URL);
  const spec = buildDesignSpec(req.params.boardId, publicBaseUrl);
  if (!spec) return res.status(404).send("Board not found");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(designPreviewHtml(spec));
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

app.post("/api/translate", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const source = req.body?.source;
  const target = req.body?.target;
  const allowedPair = (source === "en" && target === "ja") || (source === "ja" && target === "en");

  if (!text) return res.status(400).json({ error: "翻訳する文章を入力してください。" });
  if (!allowedPair) return res.status(400).json({ error: "対応していない言語の組み合わせです。" });
  if (Buffer.byteLength(text, "utf8") > 500) {
    return res.status(400).json({ error: "一度に翻訳できる文章は500バイトまでです。" });
  }

  try {
    const params = new URLSearchParams({ q: text, langpair: `${source}|${target}`, mt: "1" });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`translation service returned ${response.status}`);
    const data = await response.json();
    const translatedText = data?.responseData?.translatedText;
    if (typeof translatedText !== "string" || !translatedText.trim()) {
      throw new Error("translation response was empty");
    }
    res.json({ translatedText });
  } catch (error) {
    console.error("Translation failed:", error.message);
    res.status(502).json({ error: "翻訳サービスに接続できませんでした。少し待ってから再試行してください。" });
  }
});

function driveImageResponse(row) {
  return {
    id: row.id,
    folderId: row.folder_id || null,
    name: normalizeUploadedFilename(row.name),
    src: appUrl(row.src),
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
  if (typeof src !== "string") return;
  const relativeSrc = src.startsWith(`${APP_BASE_PATH}/`) ? src.slice(APP_BASE_PATH.length) : src;
  if (!relativeSrc.startsWith("/uploads/drive/")) return;
  const filename = path.basename(relativeSrc);
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

app.get("/api/boards/:boardId/drive/folder-images", (req, res) => {
  try {
    const board = getBoard(req.params.boardId);
    if (!board) return res.status(404).json({ error: "board not found" });
    const folderId = String(req.query.folderId || "").trim();
    if (!folderId || !isDriveFolderInBoard(board.id, folderId)) {
      return res.status(404).json({ error: "folder not found" });
    }
    res.json({
      folderId,
      images: listDriveFolderImagesRecursive(folderId).map(driveImageResponse),
    });
  } catch (err) {
    console.error("Failed to list recursive drive images", err);
    res.status(500).json({ error: "failed to list folder images" });
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
        src: appUrl(`/uploads/drive/${file.filename}`),
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
      const materialized = materializeBoardImage(boardId, img);
      if (materialized.src !== img.src) {
        saveImage({ ...materialized, board_id: boardId });
      }
      return publicImage(materialized);
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
    socket.emit("design:init", getDesignItems(boardId));
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

  socket.on("design:item:save", ({ boardId, item }, ack) => {
    if (boardId !== currentBoardId) {
      if (typeof ack === "function") ack({ ok: false, error: "board mismatch" });
      return;
    }
    try {
      const normalized = normalizeDesignItem(boardId, item, currentUserName);
      if (normalized.kind === "transition") {
        const duplicate = getDesignItems(boardId).find((candidate) => candidate.kind === "transition" && candidate.id !== normalized.id && candidate.data?.fromScreenId === normalized.data?.fromScreenId && candidate.data?.toScreenId === normalized.data?.toScreenId);
        if (duplicate) {
          if (typeof ack === "function") ack({ ok: false, error: "duplicate transition", duplicateTransitionId: duplicate.id });
          return;
        }
      }
      const saved = saveDesignItem(normalized);
      socket.to(boardId).emit("design:item:save", saved);
      if (typeof ack === "function") ack({ ok: true, item: saved });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("design:item:remove", ({ boardId, id }, ack) => {
    if (boardId !== currentBoardId || !id) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const removed = deleteDesignItem(boardId, String(id));
    if (removed) socket.to(boardId).emit("design:item:remove", { id: String(id) });
    if (typeof ack === "function") ack({ ok: !!removed });
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
      const storedImage = materializeBoardImage(boardId, image);
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
          const storedImage = materializeBoardImage(boardId, updated);
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

  socket.on("shared-window:attention", ({ boardId, itemType, itemId, title, viewState }, ack) => {
    if (boardId !== currentBoardId || !["text", "image", "link"].includes(itemType) || !itemId) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const state = ensureBoardState(boardId);
    const item = getItemsByType(state, itemType)?.find((entry) => entry?.id === itemId);
    const isSharedWindow = itemType === "text"
      ? !!(item?.textMemo || item?.calculator)
      : itemType === "image"
      ? Array.isArray(item?.slideshowSlides) && item.slideshowSlides.length > 0
      : ["embed", "spreadsheet", "google-search", "translation-en-ja", "translation-ja-en"].includes(item?.linkType);
    if (!isSharedWindow) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const safeViewState = viewState && typeof viewState === "object" ? {
      media: ["youtube", "vimeo", "html5"].includes(viewState.media) ? viewState.media : undefined,
      currentTime: Number.isFinite(viewState.currentTime)
        ? Math.max(0, Math.min(86400 * 7, viewState.currentTime))
        : undefined,
      playing: typeof viewState.playing === "boolean" ? viewState.playing : undefined,
      scrollX: Number.isFinite(viewState.scrollX) ? Math.max(-1e7, Math.min(1e7, viewState.scrollX)) : undefined,
      scrollY: Number.isFinite(viewState.scrollY) ? Math.max(-1e7, Math.min(1e7, viewState.scrollY)) : undefined,
    } : null;
    socket.to(boardId).emit("shared-window:attention", {
      itemType,
      itemId,
      title: String(title || item.title || item.imageName || item.memoTitle || "共有ウィンドウ").slice(0, 80),
      user: currentUserName || "参加者",
      viewState: safeViewState,
    });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("shared-window:navigate", ({ boardId, itemId, url, description }, ack) => {
    if (boardId !== currentBoardId || !itemId || typeof url !== "string" || url.length > 4096) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    let safeUrl;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("unsupported protocol");
      safeUrl = parsed.toString();
    } catch {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const state = ensureBoardState(boardId);
    const link = state.links.find((item) => item?.id === itemId);
    if (!link || !["embed", "google-search"].includes(link.linkType)) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    link.url = safeUrl;
    link.sourceUrl = safeUrl;
    if (typeof description === "string") link.description = description.slice(0, 2000);
    try {
      saveLink({ ...link, board_id: boardId });
      socket.to(boardId).emit("shared-window:navigate", {
        itemId,
        url: safeUrl,
        description: typeof description === "string" ? link.description : undefined,
      });
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      notifyPersistenceError(socket, "navigate shared window", err);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("board-point:attention", ({ boardId, x, y }, ack) => {
    if (boardId !== currentBoardId || !Number.isFinite(x) || !Number.isFinite(y)) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    socket.to(boardId).emit("board-point:attention", {
      x: Math.max(-1e7, Math.min(1e7, x)),
      y: Math.max(-1e7, Math.min(1e7, y)),
      user: currentUserName || "参加者",
    });
    if (typeof ack === "function") ack({ ok: true });
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
