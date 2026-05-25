// server.js（ステップ1：ボード作成まで）
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");

const {
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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: Number(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || 50 * 1024 * 1024),
});

// 設定
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

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
    boardStates.set(boardId, {
      title: dbState.title || boardId,
      strokes: (dbState.strokes || []).map((s) => ({ ...s, layer: s.layer || "user" })),
      texts: (dbState.texts || []).map((t) => ({ ...t, layer: t.layer || "user" })),
      images: dbState.images || [],
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
  });

  socket.on("user:identify", ({ boardId, user }) => {
    if (!boardId || !user) return;
    currentBoardId = boardId;
    currentUserName = user;
    const drafts = getDraftStrokes(boardId, user);
    socket.emit("draft:init", drafts);
  });

  socket.on("stroke:add", ({ boardId, stroke }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    upsertById(state.strokes, stroke);
    saveStroke({ ...stroke, board_id: boardId });
    socket.to(boardId).emit("stroke:add", stroke);
  });

  socket.on("text:add", ({ boardId, text }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const t = text.createdAt ? text : { ...text, createdAt: Date.now() };
    upsertById(state.texts, t);
    saveText({ ...t, board_id: boardId });
    socket.to(boardId).emit("text:add", t);
  });

  socket.on("image:add", ({ boardId, image }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    upsertById(state.images, image);
    saveImage({ ...image, board_id: boardId });
    socket.to(boardId).emit("image:add", image);
  });

  socket.on("link:add", ({ boardId, link }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const l = link.createdAt ? link : { ...link, createdAt: Date.now() };
    upsertById(state.links, l);
    saveLink({ ...l, board_id: boardId });
    socket.to(boardId).emit("link:add", l);
  });

  socket.on("item:update", ({ boardId, type, id, patch }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const list =
      type === "stroke"
        ? state.strokes
        : type === "text"
        ? state.texts
        : type === "image"
        ? state.images
        : state.links;
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      if (type === "stroke") {
        saveStroke({ ...list[idx], board_id: boardId });
      } else if (type === "text") {
        saveText({ ...list[idx], board_id: boardId });
      } else if (type === "image") {
        saveImage({ ...list[idx], board_id: boardId });
      } else if (type === "link") {
        saveLink({ ...list[idx], board_id: boardId });
      }
      socket.to(boardId).emit("item:update", { type, id, patch });
    }
  });

  socket.on("item:remove", ({ boardId, type, id }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const list =
      type === "stroke"
        ? state.strokes
        : type === "text"
        ? state.texts
        : type === "image"
        ? state.images
        : state.links;
    if (removeAllById(list, id)) {
      if (type === "stroke") deleteStroke(boardId, id);
      else if (type === "text") deleteText(boardId, id);
      else if (type === "image") deleteImage(boardId, id);
      else if (type === "link") deleteLink(boardId, id);
      socket.to(boardId).emit("item:remove", { type, id });
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
    currentBoardId = null;
  });
});

// サーバ起動
server.listen(PORT, HOST, () => {
  console.log(`Whiteboard server running on http://${HOST}:${PORT}`);
});
