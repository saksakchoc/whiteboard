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
  getBoardState,
} = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 設定
const PORT = process.env.PORT || 3001;

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

// （今はまだ使わないけど、あとでフロントから呼ぶAPI）
// --- WebSocket (Socket.IO) ---
// 各ボードごとに簡易なメモリ上の状態を持つ
// { strokes:[], texts:[], images:[] }
const boardStates = new Map();

function ensureBoardState(boardId) {
  if (!boardStates.has(boardId)) {
    const dbState = getBoardState(boardId);
    boardStates.set(boardId, {
      title: dbState.title || boardId,
      strokes: dbState.strokes || [],
      texts: dbState.texts || [],
      images: dbState.images || [],
    });
  }
  return boardStates.get(boardId);
}

io.on("connection", (socket) => {
  let currentBoardId = null;

  socket.on("join", ({ boardId }) => {
    const board = getBoard(boardId);
    if (!board) {
      socket.emit("error-message", "Board not found");
      return;
    }
    currentBoardId = boardId;
    socket.join(boardId);
    const state = ensureBoardState(boardId);
    socket.emit("init", state);
  });

  socket.on("stroke:add", ({ boardId, stroke }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    state.strokes.push(stroke);
    saveStroke({ ...stroke, board_id: boardId });
    socket.to(boardId).emit("stroke:add", stroke);
  });

  socket.on("text:add", ({ boardId, text }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const t = text.createdAt ? text : { ...text, createdAt: Date.now() };
    state.texts.push(t);
    saveText({ ...t, board_id: boardId });
    socket.to(boardId).emit("text:add", t);
  });

  socket.on("image:add", ({ boardId, image }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    state.images.push(image);
    saveImage({ ...image, board_id: boardId });
    socket.to(boardId).emit("image:add", image);
  });

  socket.on("item:update", ({ boardId, type, id, patch }) => {
    if (boardId !== currentBoardId) return;
    const state = ensureBoardState(boardId);
    const list =
      type === "stroke"
        ? state.strokes
        : type === "text"
        ? state.texts
        : state.images;
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      if (type === "stroke") {
        saveStroke({ ...list[idx], board_id: boardId });
      } else if (type === "text") {
        saveText({ ...list[idx], board_id: boardId });
      } else if (type === "image") {
        saveImage({ ...list[idx], board_id: boardId });
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
        : state.images;
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      if (type === "stroke") deleteStroke(boardId, id);
      else if (type === "text") deleteText(boardId, id);
      else if (type === "image") deleteImage(boardId, id);
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

  socket.on("disconnect", () => {
    currentBoardId = null;
  });
});

// サーバ起動
server.listen(PORT, () => {
  console.log(`Whiteboard server running on http://localhost:${PORT}`);
});
