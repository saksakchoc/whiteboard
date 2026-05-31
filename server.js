// server.js（ステップ1：ボード作成まで）
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const https = require("https");
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
  getDraftStrokes,
  addUser,
  linkUserToBoard,
  getBoardUsers,
} = require("./db");

// 設定
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "";
const SSL_CA_PATH = process.env.SSL_CA_PATH || "";

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

// 新しいボードを作成してリダイレクト
app.get("/new", (req, res) => {
  let id;
  do {
    id = generateBoardId();
  } while (getBoard(id)); // かぶり防止

  createBoard(id);
  res.redirect(`/b/${id}`);
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
  if (!boardId || !name) {
    return res.status(400).json({ error: "invalid params" });
  }
  try {
    addUser(name);
    linkUserToBoard(boardId, name);
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
  });

  socket.on("user:identify", ({ boardId, user }) => {
    if (!boardId || !user) return;
    currentBoardId = boardId;
    currentUserName = user;
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
    if (list.some((item) => item?.id === id)) {
      try {
        if (type === "stroke") deleteStroke(boardId, id);
        else if (type === "text") deleteText(boardId, id);
        else if (type === "image") deleteImage(boardId, id);
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
