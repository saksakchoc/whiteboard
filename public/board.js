// public/board.js
(() => {
  const canvas = document.getElementById("board-canvas");
  const container = document.getElementById("canvas-container");
  const boardIdLabel = document.getElementById("board-id-label");
  const boardTitleLabel = document.getElementById("board-title");
  const currentUserLabel = document.getElementById("current-user-label");
  const colorPicker = document.getElementById("color-picker");
  const sizeRange = document.getElementById("size-range");
  const sizeLabel = document.getElementById("size-label");
  const penToolBtn = document.getElementById("pen-tool-btn");
  const eraserToolBtn = document.getElementById("eraser-tool-btn");
  const selectToolBtn = document.getElementById("select-tool-btn");
  const strokeAlphaToggleBtn = document.getElementById("stroke-alpha-toggle-btn");
  const templateSelect = document.getElementById("template-select");
  const textListBtn = document.getElementById("text-list-btn");
  const textListPanel = document.getElementById("text-list-panel");
  const textListBody = document.getElementById("text-list-body");
  const textListCloseBtn = document.getElementById("text-list-close-btn");
  const undoBtn = document.getElementById("undo-btn");
  const swatches = Array.from(document.querySelectorAll(".color-swatch"));
  const favButtons = Array.from(document.querySelectorAll(".color-fav"));
  const userModal = document.getElementById("user-modal");
  const userNameInput = document.getElementById("user-name-input");
  const userDatalist = document.getElementById("user-datalist");
  const userJoinBtn = document.getElementById("user-join-btn");

  const ctx = canvas.getContext("2d");

  // --- ボードID表示 ---
  const boardId = window.location.pathname.split("/").pop();
  const userStorageKey = `board-users-${boardId}`;
  let boardTitle = boardId;
  const favoriteStorageKey = `favorites-${boardId}`;
  let favoritesByUser = loadFavorites();

  // --- 状態 ---
  // ペン用の現在色
  let currentColor = "#000000";
  let currentSize = parseInt(sizeRange.value, 10);
  let currentTool = "pen"; // "pen" | "select" | "eraser"
  let currentUser = "";
  let knownUsers = [];
  let strokesDimmed = false;
  const DIM_ALPHA = 0.35;
  let attentionActive = false;
  const attentionPointers = new Map(); // user -> {x,y,color,updatedAt}
  let attentionTimeout = null;
  let attentionAnimRaf = null;

  // テキストの「デフォルト色＆サイズ」（最後に使った文字の色と大きさを記憶）
  let textDefaultColor = "#000000";
  let textDefaultFontSizeWorld = 16; // ホワイトボード座標系でのフォントサイズ

  // 図形データ
  const strokes = []; // { id, color, size, points: [{x,y}], user, order }
  const images = [];  // { id, img, src, x, y, width, height, layer: "base", order }
  const texts = [];   // { id, lines:[string], x, y, fontSize, color, user, order, createdAt, label }
  let textListOpen = false;

  // ズーム・パン
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 4.0;

  // 状態フラグ
  let isDrawing = false;
  let isPanning = false;
  let isDraggingObject = false;
  let isResizingObject = false;
  let isErasing = false;
  let pendingTextPos = null;
  let activeStrokeId = null;

  let lastPan = { x: 0, y: 0 };
  let lastMouseScreen = { x: 0, y: 0 };
  let templates = [];
  const ATTENTION_TIMEOUT_MS = 10000;

  // 選択中オブジェクト
  // selected = { type: "image"|"text", index: number } or null
  let selected = null;
  let dragOffsetWorld = { x: 0, y: 0 };
  let resizeInfo = null; // { type, index, originX, originY, startW, startH, fontSize }

  // テキスト入力用（HTMLの textarea オーバーレイ）
  let textEditor = null;
  let orderCounter = 0; // 描画優先順位（ペンとテキストで共有）

  // --- ID/Order ユーティリティ ---
  function genId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function bumpOrderCounter(orderValue) {
    if (typeof orderValue === "number") {
      orderCounter = Math.max(orderCounter, orderValue + 1);
    } else {
      orderCounter += 1;
    }
    return orderCounter;
  }

  // --- キャンバスサイズ ---
  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // --- 座標変換 ---
  function screenToWorld(x, y) {
    return {
      x: (x - offsetX) / scale,
      y: (y - offsetY) / scale,
    };
  }

  function worldToScreen(x, y) {
    return {
      x: x * scale + offsetX,
      y: y * scale + offsetY,
    };
  }

  function getCanvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  // マウス位置を常に覚えておく（貼り付け位置用）
  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      lastMouseScreen = { x, y };
    }
  });

  // --- ユーザー管理 ---
  function loadStoredUsers() {
    try {
      const raw = localStorage.getItem(userStorageKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(favoriteStorageKey);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(favoriteStorageKey, JSON.stringify(favoritesByUser));
    } catch {
      // ignore
    }
  }

  function saveStoredUsers(users) {
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(users));
    } catch {
      // ignore storage errors
    }
  }

  function collectKnownUsers() {
    const set = new Set(loadStoredUsers());
    if (currentUser) set.add(currentUser);
    strokes.forEach((s) => s.user && set.add(s.user));
    texts.forEach((t) => t.user && set.add(t.user));
    images.forEach((img) => img.user && set.add(img.user));
    knownUsers = Array.from(set);
  }

  function registerUser(name) {
    if (!name) return;
    collectKnownUsers();
    if (!knownUsers.includes(name)) {
      knownUsers.push(name);
      saveStoredUsers(knownUsers);
    } else {
      saveStoredUsers(knownUsers);
    }
    refreshUserDatalist();
  }

  function refreshUserDatalist() {
    collectKnownUsers();
    userDatalist.innerHTML = "";
    knownUsers.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      userDatalist.appendChild(opt);
    });
  }

  function updateFavButtons() {
    const favColor = favoritesByUser[currentUser];
    favButtons.forEach((btn) => {
      const c = btn.getAttribute("data-color");
      if (favColor && favColor === c) {
        btn.classList.add("active");
        btn.textContent = "★";
      } else {
        btn.classList.remove("active");
        btn.textContent = "☆";
      }
    });
  }

  function getCurrentFavoriteColor() {
    return favoritesByUser[currentUser] || "#ff3b30"; // デフォルト赤
  }

  function sortTextsByCreated() {
    return texts
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function openTextList() {
    textListOpen = true;
    textListPanel.classList.remove("hidden");
    renderTextList();
  }

  function closeTextList() {
    textListOpen = false;
    textListPanel.classList.add("hidden");
  }

  function renderTextList() {
    if (!textListOpen) return;
    textListBody.innerHTML = "";
    const sorted = sortTextsByCreated();
    sorted.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "text-list-item";
      item.dataset.id = t.id;

      const meta = document.createElement("div");
      meta.className = "text-list-meta";
      meta.textContent = `#${idx + 1}`;

      const labelRow = document.createElement("div");
      labelRow.className = "text-label-row";
      const labelBadge = document.createElement("span");
      labelBadge.className = "text-label-badge";
      const firstLine = t.lines && t.lines.length > 0 ? t.lines[0] : "";
      const labelText = t.label ? `${t.label}` : "#";
      labelBadge.textContent = labelText;
      labelBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = t.label || "";
        const newLabel = window.prompt("ラベルを入力", current);
        if (newLabel === null) return;
        setTextLabel(t.id, newLabel.trim());
      });

      labelRow.appendChild(labelBadge);

      const content = document.createElement("div");
      content.className = "text-list-content";
      content.textContent = t.lines.join("\n");

      item.appendChild(meta);
      item.appendChild(labelRow);
      item.appendChild(content);

      item.addEventListener("click", () => {
        const targetIdx = findIndexById(texts, t.id);
        if (targetIdx >= 0) {
          const target = texts[targetIdx];
          // 中心に移動
          const screenW = canvas.width;
          const screenH = canvas.height;
          offsetX = screenW / 2 - target.x * scale;
          offsetY = screenH / 2 - target.y * scale;
          selected = { type: "text", index: targetIdx };
          currentTool = "select";
          updateToolButtons();
          redraw();
        }
      });

      textListBody.appendChild(item);
    });
  }

  function refreshTextList() {
    if (textListOpen) {
      renderTextList();
    }
  }

  function setTextLabel(textId, label) {
    const idx = findIndexById(texts, textId);
    if (idx < 0) return;
    texts[idx].label = label;
    refreshTextList();
    if (socketConnected) {
      socket.emit("item:update", {
        boardId,
        type: "text",
        id: textId,
        patch: { label },
      });
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("failed");
      templates = await res.json();
    } catch {
      templates = [];
    }
    templateSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "テンプレ画像挿入";
    templateSelect.appendChild(placeholder);

    templates.forEach((filename) => {
      const src = `/templates/${filename}`;
      const opt = document.createElement("option");
      opt.value = src;
      const name = filename.replace(/\.png$/i, "");
      opt.textContent = name;
      templateSelect.appendChild(opt);
    });
  }

  function updateBoardTitleDisplay() {
    boardTitleLabel.textContent = `${boardTitle}`;
    document.title = `${boardTitle}`;
  }

  function setCurrentUser(name) {
    currentUser = name;
    if (name) {
      registerUser(name);
      currentTool = "pen";
      updateToolButtons();
    }
    updateFavButtons();
  }

  function requireUser() {
    if (currentUser) return true;
    openUserModal();
    return false;
  }

  // --- 選択削除（画像のみ） ---
  function deleteSelectedImage() {
    if (!selected || selected.type !== "image") return;
    const removed = images.splice(selected.index, 1)[0];
    if (removed && socketConnected) {
      socket.emit("item:remove", { boardId, type: "image", id: removed.id });
    }
    selected = null;
    redraw();
  }

  function openUserModal() {
    closeTextList();
    refreshUserDatalist();
    const stored = loadStoredUsers();
    if (stored && stored.length > 0 && !userNameInput.value) {
      userNameInput.value = stored[stored.length - 1];
    }
    userModal.classList.remove("hidden");
    setTimeout(() => userNameInput.focus(), 0);
  }

  function closeUserModal() {
    userModal.classList.add("hidden");
  }

  // --- ソケット接続 ---
  const socket = io();
  let socketConnected = false;

  socket.on("connect", () => {
    socketConnected = true;
    socket.emit("join", { boardId });
  });

  socket.on("disconnect", () => {
    socketConnected = false;
  });

  // --- テキストのバウンディングボックス ---
  function getTextBoundsWorld(t) {
    const fontSize = t.fontSize || 16;
    const lineHeight = fontSize * 1.2;
    const paddingX = Math.max(4, fontSize * 0.35); // 横は少し広め
    const paddingY = Math.max(2, fontSize * 0.15); // 縦の余白は控えめに

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    const maxWidth = t.lines.reduce((max, line) => {
      const w = ctx.measureText(line || "").width;
      return Math.max(max, w);
    }, 0);
    ctx.restore();

    const h = lineHeight * t.lines.length;
    return {
      x: t.x - paddingX,
      y: t.y - paddingY,
      width: maxWidth + paddingX * 2,
      height: h + paddingY * 2,
    };
  }

  function canDeleteText(t) {
    return !t.user || t.user === currentUser;
  }

  function canDeleteStroke(stroke) {
    return !stroke.user || stroke.user === currentUser;
  }

  function findIndexById(arr, id) {
    return arr.findIndex((x) => x.id === id);
  }

  function applyInitialState(state) {
    if (state?.title) {
      boardTitle = state.title;
    }
    updateBoardTitleDisplay();

    strokes.length = 0;
    texts.length = 0;
    images.length = 0;
    orderCounter = 0;

    if (state?.strokes) {
      state.strokes.forEach((s) => addStrokeFromNetwork(s, false));
    }
    if (state?.texts) {
      state.texts.forEach((t) => addTextFromNetwork(t, false));
    }
    if (state?.images) {
      state.images.forEach((img) => addImageFromNetwork(img, false));
    }
    redraw();
  }

  function addStrokeFromNetwork(stroke, shouldRedraw = true) {
    if (findIndexById(strokes, stroke.id) >= 0) return;
    strokes.push(stroke);
    bumpOrderCounter(stroke.order);
    registerUser(stroke.user);
    if (shouldRedraw) redraw();
  }

  function addTextFromNetwork(text, shouldRedraw = true) {
    if (findIndexById(texts, text.id) >= 0) return;
    const withCreated = {
      ...text,
      createdAt: text.createdAt || Date.now(),
      label: text.label || "",
    };
    texts.push(withCreated);
    bumpOrderCounter(text.order);
    registerUser(text.user);
    refreshTextList();
    if (shouldRedraw) redraw();
  }

  function addImageFromNetwork(imgData, shouldRedraw = true) {
    if (findIndexById(images, imgData.id) >= 0) return;
    const img = new Image();
    img.onload = () => {
      images.push({ ...imgData, img });
      bumpOrderCounter(imgData.order);
      registerUser(imgData.user);
      if (shouldRedraw) redraw();
    };
    img.src = imgData.src;
  }

  socket.on("init", (state) => {
    applyInitialState(state);
    refreshUserDatalist();
    updateFavButtons();
    refreshTextList();
  });

  socket.on("stroke:add", (stroke) => {
    addStrokeFromNetwork(stroke);
  });

  socket.on("text:add", (text) => {
    addTextFromNetwork(text);
  });

  socket.on("image:add", (img) => {
    addImageFromNetwork(img);
  });

  socket.on("board:title:update", ({ title }) => {
    boardTitle = title || boardId;
    updateBoardTitleDisplay();
  });

  socket.on("attention:start", (data) => {
    if (!data || !data.user) return;
    attentionPointers.set(data.user, {
      x: data.x,
      y: data.y,
      color: data.color || "#ff3b30",
      updatedAt: Date.now(),
    });
    ensureAttentionAnimation();
    redraw();
  });

  socket.on("attention:update", (data) => {
    if (!data || !data.user) return;
    attentionPointers.set(data.user, {
      x: data.x,
      y: data.y,
      color: data.color || "#ff3b30",
      updatedAt: Date.now(),
    });
    ensureAttentionAnimation();
    redraw();
  });

  socket.on("attention:end", ({ user }) => {
    if (!user) return;
    attentionPointers.delete(user);
    if (attentionPointers.size === 0) {
      stopAttentionAnimation();
    }
    redraw();
  });

  socket.on("item:remove", ({ type, id }) => {
    if (type === "stroke") {
      const idx = findIndexById(strokes, id);
      if (idx >= 0) strokes.splice(idx, 1);
    } else if (type === "text") {
      const idx = findIndexById(texts, id);
      if (idx >= 0) texts.splice(idx, 1);
    } else if (type === "image") {
      const idx = findIndexById(images, id);
      if (idx >= 0) images.splice(idx, 1);
    }
    refreshTextList();
    redraw();
  });

  socket.on("item:update", ({ type, id, patch }) => {
    const list =
      type === "stroke"
        ? strokes
        : type === "text"
        ? texts
        : images;
    const idx = findIndexById(list, id);
    if (idx >= 0) {
      if (type === "image") {
        list[idx] = { ...list[idx], ...patch };
      } else {
        list[idx] = { ...list[idx], ...patch };
      }
      if (type === "text") {
        refreshTextList();
      }
      redraw();
    }
  });

  // --- 画像ヒットテスト ---
  function hitTestImage(screenX, screenY) {
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      const p = worldToScreen(imgObj.x, imgObj.y);
      const w = imgObj.width * scale;
      const h = imgObj.height * scale;
      if (
        screenX >= p.x &&
        screenX <= p.x + w &&
        screenY >= p.y &&
        screenY <= p.y + h
      ) {
        return i;
      }
    }
    return -1;
  }

  function hitTestImageResizeHandle(screenX, screenY, radius = 8) {
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      const p = worldToScreen(imgObj.x, imgObj.y);
      const w = imgObj.width * scale;
      const h = imgObj.height * scale;

      const hx = p.x + w;
      const hy = p.y + h;
      const dx = screenX - hx;
      const dy = screenY - hy;
      if (dx * dx + dy * dy <= radius * radius) {
        return i;
      }
    }
    return -1;
  }

  // --- テキストヒットテスト ---
  function hitTestText(screenX, screenY) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const b = getTextBoundsWorld(t);
      const p = worldToScreen(b.x, b.y);
      const w = b.width * scale;
      const h = b.height * scale;
      if (
        screenX >= p.x &&
        screenX <= p.x + w &&
        screenY >= p.y &&
        screenY <= p.y + h
      ) {
        return i;
      }
    }
    return -1;
  }

  function hitTestTextResizeHandle(screenX, screenY, radius = 8) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const b = getTextBoundsWorld(t);
      const p = worldToScreen(b.x, b.y);
      const w = b.width * scale;
      const h = b.height * scale;
      const hx = p.x + w;
      const hy = p.y + h;
      const dx = screenX - hx;
      const dy = screenY - hy;
      if (dx * dx + dy * dy <= radius * radius) {
        return i;
      }
    }
    return -1;
  }

  function distancePointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
      const ddx = px - ax;
      const ddy = py - ay;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
    );
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const ddx = px - projX;
    const ddy = py - projY;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  function eraseAt(worldX, worldY) {
    let erased = false;
    const radiusWorld = 10 / scale;

    // テキスト（自分のレイヤーのみ）
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!canDeleteText(t)) continue;
      const b = getTextBoundsWorld(t);
      if (
        worldX >= b.x &&
        worldX <= b.x + b.width &&
        worldY >= b.y &&
        worldY <= b.y + b.height
      ) {
        const removed = texts.splice(i, 1)[0];
        if (selected && selected.type === "text" && selected.index >= i) {
          selected = null;
        }
        if (removed && socketConnected) {
          socket.emit("item:remove", { boardId, type: "text", id: removed.id });
        }
        erased = true;
        refreshTextList();
        break;
      }
    }

    // ペンストローク（自分のレイヤーのみ）
    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      if (!canDeleteStroke(stroke)) continue;
      const pts = stroke.points;
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const dist = distancePointToSegment(worldX, worldY, a.x, a.y, b.x, b.y);
        if (dist <= radiusWorld) {
          const removed = strokes.splice(i, 1)[0];
          if (removed && socketConnected) {
            socket.emit("item:remove", { boardId, type: "stroke", id: removed.id });
          }
          erased = true;
          break;
        }
      }
      if (erased) break;
    }

    if (erased) {
      redraw();
    }
  }

  // --- 描画処理 ---
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 画像
    images.forEach((imgObj, i) => {
      const p = worldToScreen(imgObj.x, imgObj.y);
      const w = imgObj.width * scale;
      const h = imgObj.height * scale;
      ctx.drawImage(imgObj.img, p.x, p.y, w, h);

      if (selected && selected.type === "image" && selected.index === i) {
        drawSelectionRect(p.x, p.y, w, h);
      }
    });

    // 2. ペンとテキスト（同順位。order の後勝ち）
    const combined = [];
    strokes.forEach((s, idx) =>
      combined.push({ type: "stroke", order: s.order ?? idx, index: idx })
    );
    texts.forEach((t, idx) =>
      combined.push({ type: "text", order: t.order ?? (strokes.length + idx), index: idx })
    );
    combined.sort((a, b) => a.order - b.order);

    ctx.textBaseline = "top";
    for (const item of combined) {
      if (item.type === "stroke") {
        const stroke = strokes[item.index];
        if (!stroke || !stroke.points || stroke.points.length === 0) continue;
        ctx.save();
        ctx.globalAlpha = strokesDimmed ? DIM_ALPHA : 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * scale; // ズームに合わせて太さを変える
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        const first = worldToScreen(stroke.points[0].x, stroke.points[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = worldToScreen(stroke.points[i].x, stroke.points[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (!t) continue;
        const base = worldToScreen(t.x, t.y);
        const fontSizePx = (t.fontSize || 16) * scale;
        const lineHeight = fontSizePx * 1.2;
        ctx.font = `${fontSizePx}px sans-serif`;
        ctx.fillStyle = t.color || "#000000";

        t.lines.forEach((line, idx) => {
          ctx.fillText(line, base.x, base.y + idx * lineHeight);
        });

        if (selected && selected.type === "text" && selected.index === item.index) {
          const b = getTextBoundsWorld(t);
          const p = worldToScreen(b.x, b.y);
          const w = b.width * scale;
          const h = b.height * scale;
          drawSelectionRect(p.x, p.y, w, h);
        }
      }
    }

    // 3. 最前面オーバーレイ：レーザーポインタ
    drawAttentionPointers();
  }

  function drawSelectionRect(x, y, w, h) {
    ctx.save();
    ctx.strokeStyle = "#0078d7";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    const handleSize = 8;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0078d7";
    ctx.beginPath();
    ctx.rect(
      x + w - handleSize / 2,
      y + h - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function stopAttentionAnimation() {
    if (attentionAnimRaf !== null) {
      cancelAnimationFrame(attentionAnimRaf);
      attentionAnimRaf = null;
    }
  }

  function requestAttentionFrame() {
    if (attentionAnimRaf !== null) return;
    attentionAnimRaf = requestAnimationFrame(attentionRender);
  }

  function attentionRender() {
    attentionAnimRaf = null;
    redraw();
    if (attentionPointers.size > 0) {
      requestAttentionFrame();
    }
  }

  function ensureAttentionAnimation() {
    if (attentionPointers.size > 0) {
      requestAttentionFrame();
    }
  }

  function drawAttentionPointers() {
    // 消し忘れ防止: 古いものを掃除
    const now = Date.now();
    for (const [user, p] of Array.from(attentionPointers.entries())) {
      if (user === currentUser && attentionActive) continue;
      if (now - p.updatedAt > ATTENTION_TIMEOUT_MS) {
        attentionPointers.delete(user);
      }
    }
    if (attentionPointers.size === 0) {
      stopAttentionAnimation();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const t = typeof performance !== "undefined" ? performance.now() : Date.now();

    attentionPointers.forEach((p) => {
      const screen = worldToScreen(p.x, p.y);
      const color = p.color || "#ff3b30";
      const visible =
        screen.x >= 0 && screen.x <= w && screen.y >= 0 && screen.y <= h;

      if (visible) {
        drawLaser(screen.x, screen.y, color);
      } else {
        drawAttentionArrow(screen.x, screen.y, color, w, h, t);
      }
    });
  }

  function drawLaser(x, y, color) {
    ctx.save();
    const radius = 10;
    ctx.globalAlpha = 0.8;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius * 1.6);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAttentionArrow(x, y, color, w, h, t) {
    ctx.save();
    const padding = 10;
    const baseSize = 38;
    const pulse = 1 + 0.45 * Math.sin(t / 140);
    const nudge = 9 * Math.sin(t / 200);
    const size = baseSize * pulse;
    let drawX = Math.min(Math.max(x, padding), w - padding);
    let drawY = Math.min(Math.max(y, padding), h - padding);

    const dirX = x < 0 ? -1 : x > w ? 1 : 0;
    const dirY = y < 0 ? -1 : y > h ? 1 : 0;

    // 辺に張り付け
    if (dirX === -1) drawX = padding;
    if (dirX === 1) drawX = w - padding;
    if (dirY === -1) drawY = padding;
    if (dirY === 1) drawY = h - padding;

    ctx.translate(drawX, drawY);
    let angle = 0;
    if (dirX === -1 && dirY === 0) angle = Math.PI; // left
    else if (dirX === 1 && dirY === 0) angle = 0; // right
    else if (dirX === 0 && dirY === -1) angle = -Math.PI / 2; // top
    else if (dirX === 0 && dirY === 1) angle = Math.PI / 2; // bottom
    else if (dirX === -1 && dirY === -1) angle = -Math.PI * 3 / 4;
    else if (dirX === 1 && dirY === -1) angle = -Math.PI / 4;
    else if (dirX === -1 && dirY === 1) angle = Math.PI * 3 / 4;
    else if (dirX === 1 && dirY === 1) angle = Math.PI / 4;

    const wiggle = 0.12 * Math.sin(t / 180);
    ctx.rotate(angle + wiggle);
    ctx.translate(dirX * nudge, dirY * nudge);
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    // ➤ 風シェイプ
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size, -size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- 画像追加 ---
  function addImageFile(file, worldX, worldY) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWorldWidth = (canvas.width / scale) * 0.6;
        const maxWorldHeight = (canvas.height / scale) * 0.6;
        let w = img.width;
        let h = img.height;
        const r = Math.min(1, maxWorldWidth / w, maxWorldHeight / h);
        w *= r;
        h *= r;

        const imgObj = {
          id: genId(),
          img,
          src: reader.result,
          x: worldX - w / 2,
          y: worldY - h / 2,
          width: w,
          height: h,
          layer: "base",
          order: orderCounter++,
          user: currentUser,
        };
        images.push(imgObj);
        registerUser(currentUser);
        emitImageAdd(imgObj);

        // 貼り付け直後は選択ツールに切り替えて、その画像を選択
        currentTool = "select";
        updateToolButtons();
        selected = { type: "image", index: images.length - 1 };
        redraw();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function emitImageAdd(imgObj) {
    if (!socketConnected) return;
    socket.emit("image:add", {
      boardId,
      image: {
        id: imgObj.id,
        src: imgObj.src,
        x: imgObj.x,
        y: imgObj.y,
        width: imgObj.width,
        height: imgObj.height,
        layer: imgObj.layer,
        order: imgObj.order,
        user: imgObj.user,
      },
    });
  }

  function addTemplateImage(src, worldX, worldY) {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const maxWorldWidth = (canvas.width / scale) * 0.6;
      const maxWorldHeight = (canvas.height / scale) * 0.6;
      let w = img.width;
      let h = img.height;
      const r = Math.min(1, maxWorldWidth / w, maxWorldHeight / h);
      w *= r;
      h *= r;

      const imgObj = {
        id: genId(),
        img,
        src,
        x: worldX - w / 2,
        y: worldY - h / 2,
        width: w,
        height: h,
        layer: "base",
        order: orderCounter++,
        user: currentUser,
      };
      images.push(imgObj);
      registerUser(currentUser);
      emitImageAdd(imgObj);

      currentTool = "select";
      updateToolButtons();
      selected = { type: "image", index: images.length - 1 };
      redraw();
    };
    img.src = src;
  }

  function endAttention() {
    attentionActive = false;
    canvas.classList.remove("attention-cursor");
    attentionPointers.delete(currentUser);
    clearTimeout(attentionTimeout);
    attentionTimeout = null;
    if (attentionPointers.size === 0) {
      stopAttentionAnimation();
    }
    if (socketConnected) {
      socket.emit("attention:end", { boardId, user: currentUser });
    }
    redraw();
  }

  function emitImageAdd(imgObj) {
    if (!socketConnected) return;
    socket.emit("image:add", {
      boardId,
      image: {
        id: imgObj.id,
        src: imgObj.src,
        x: imgObj.x,
        y: imgObj.y,
        width: imgObj.width,
        height: imgObj.height,
        layer: imgObj.layer,
        order: imgObj.order,
        user: imgObj.user,
      },
    });
  }

  // --- テキスト入力（選択ツールで空白をクリックしたとき） ---
  function createTextEditorAt(screenX, screenY, initialValue = "") {
    if (!requireUser()) return;
    pendingTextPos = null;

    if (textEditor) {
      textEditor.remove();
      textEditor = null;
    }

    const textarea = document.createElement("textarea");
    textarea.className = "text-editor-overlay";

    const fontSizeWorld = textDefaultFontSizeWorld || 16;
    const fontSizePx = fontSizeWorld * scale;
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.style.width = `200px`;
    textarea.style.height = `${fontSizePx * 1.2 + 4}px`;
    textarea.style.fontSize = `${fontSizePx}px`;
    textarea.style.color = textDefaultColor;

    textarea.value = initialValue || "";
    container.appendChild(textarea);
    textarea.focus();
    textEditor = textarea;
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);

    const finish = () => {
      if (!textEditor) return;
      const value = textEditor.value;
      const rect = textEditor.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sx = rect.left - containerRect.left;
      const sy = rect.top - containerRect.top;
      const worldPos = screenToWorld(sx, sy);

      textEditor.remove();
      textEditor = null;

      if (value.trim()) {
        const lines = value.split(/\r?\n/);
      const t = {
        id: genId(),
        lines,
        x: worldPos.x,
        y: worldPos.y,
        fontSize: fontSizeWorld,
        color: textDefaultColor,
        user: currentUser,
        order: orderCounter++,
        createdAt: Date.now(),
        label: "",
      };
        texts.push(t);
        registerUser(currentUser);
        if (socketConnected) {
          socket.emit("text:add", { boardId, text: t });
        }

        refreshTextList();

        // このテキストの色とサイズをデフォルトとして記憶
        textDefaultColor = t.color;
        textDefaultFontSizeWorld = t.fontSize;

        currentTool = "select";
        updateToolButtons();
        selected = { type: "text", index: texts.length - 1 };
        redraw();
      }
    };

    textarea.addEventListener("blur", finish);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finish();
      }
    });
  }

  // --- クリップボードからのテキスト挿入 ---
  function addTextFromClipboard(text, worldX, worldY) {
    const lines = text.split(/\r?\n/);
    const t = {
      id: genId(),
      lines,
      x: worldX,
      y: worldY,
      fontSize: textDefaultFontSizeWorld || 16,
      color: textDefaultColor,
      user: currentUser,
      order: orderCounter++,
      createdAt: Date.now(),
      label: "",
    };
    texts.push(t);
    registerUser(currentUser);
    if (socketConnected) {
      socket.emit("text:add", { boardId, text: t });
    }
    refreshTextList();

    // このテキストをデフォルトとして記憶
    textDefaultColor = t.color;
    textDefaultFontSizeWorld = t.fontSize;

    currentTool = "select";
    updateToolButtons();
    selected = { type: "text", index: texts.length - 1 };
    redraw();
  }

  // --- ポインタ操作 ---

  function handlePointerDown(e) {
    // テキストエディタ表示中に外側をクリック/タップしたら確定
    if (textEditor && e.target !== textEditor) {
      textEditor.blur();
      return;
    }

    e.preventDefault();

    const canvasPos = getCanvasPointFromEvent(e);
    lastMouseScreen = { x: canvasPos.x, y: canvasPos.y };
    pendingTextPos = null;

    // 右クリック → パン
    if (e.button === 2) {
      isPanning = true;
      lastPan = { x: e.clientX, y: e.clientY };
      return;
    }

    // 消しゴム
    if (currentTool === "eraser") {
      if (!requireUser()) return;
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      selected = null;
      isErasing = true;
      eraseAt(worldPos.x, worldPos.y);
      return;
    }

    // 選択ツールでないときは、ペン専用
    if (currentTool !== "select") {
      if (!requireUser()) return;
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const stroke = {
        id: genId(),
        color: currentColor,
        size: currentSize,
        points: [worldPos],
        user: currentUser,
        order: orderCounter++,
      };
      strokes.push(stroke);
      registerUser(currentUser);
      activeStrokeId = stroke.id;
      isDrawing = true;
      redraw();
      return;
    }

    // 以下、選択ツール時の処理
    // テキストのリサイズハンドル
    const textHandleIndex = hitTestTextResizeHandle(canvasPos.x, canvasPos.y);
    if (textHandleIndex >= 0) {
      selected = { type: "text", index: textHandleIndex };
      const t = texts[textHandleIndex];
      const b = getTextBoundsWorld(t);
      resizeInfo = {
        type: "text",
        index: textHandleIndex,
        originX: b.x,
        originY: b.y,
        startW: b.width,
        startH: b.height,
        fontSize: t.fontSize,
      };
      isResizingObject = true;
      redraw();
      return;
    }

    // 画像のリサイズハンドル
    const imgHandleIndex = hitTestImageResizeHandle(canvasPos.x, canvasPos.y);
    if (imgHandleIndex >= 0) {
      selected = { type: "image", index: imgHandleIndex };
      const imgObj = images[imgHandleIndex];
      resizeInfo = {
        type: "image",
        index: imgHandleIndex,
        originX: imgObj.x,
        originY: imgObj.y,
        startW: imgObj.width,
        startH: imgObj.height,
      };
      isResizingObject = true;
      redraw();
      return;
    }

    // テキスト本体ヒット → ドラッグ移動
    const textIndex = hitTestText(canvasPos.x, canvasPos.y);
    if (textIndex >= 0) {
      selected = { type: "text", index: textIndex };
      const t = texts[textIndex];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - t.x,
        y: worldPos.y - t.y,
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    // 画像本体ヒット → ドラッグ移動
    const imgIndex = hitTestImage(canvasPos.x, canvasPos.y);
    if (imgIndex >= 0) {
      selected = { type: "image", index: imgIndex };
      const imgObj = images[imgIndex];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - imgObj.x,
        y: worldPos.y - imgObj.y,
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    // 何もない場所 → テキスト入力座標を記憶（キー入力で開始）
    selected = null;
    redraw();
    pendingTextPos = { x: canvasPos.x, y: canvasPos.y };
  }

  function handlePointerMove(e) {
    const canvasPos = getCanvasPointFromEvent(e);
    lastMouseScreen = { x: canvasPos.x, y: canvasPos.y };

    if (!(isDrawing || isPanning || isDraggingObject || isResizingObject || isErasing)) {
      return;
    }
    e.preventDefault();

    if (isDrawing) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const stroke = strokes[strokes.length - 1];
      stroke.points.push(worldPos);
      redraw();
    }

    if (isPanning) {
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      offsetX += dx;
      offsetY += dy;
      lastPan = { x: e.clientX, y: e.clientY };
      redraw();
    }

    if (isDraggingObject && selected) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      if (selected.type === "image") {
        const imgObj = images[selected.index];
        imgObj.x = worldPos.x - dragOffsetWorld.x;
        imgObj.y = worldPos.y - dragOffsetWorld.y;
      } else if (selected.type === "text") {
        const t = texts[selected.index];
        t.x = worldPos.x - dragOffsetWorld.x;
        t.y = worldPos.y - dragOffsetWorld.y;
      }
      redraw();
    }

    if (isResizingObject && resizeInfo && selected) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const dx = worldPos.x - resizeInfo.originX;
      const dy = worldPos.y - resizeInfo.originY;
      const base = Math.max(dx, dy, 10);
      if (resizeInfo.type === "image") {
        const factor =
          base / Math.max(resizeInfo.startW, resizeInfo.startH, 1);
        const imgObj = images[resizeInfo.index];
        imgObj.width = resizeInfo.startW * factor;
        imgObj.height = resizeInfo.startH * factor;
      } else if (resizeInfo.type === "text") {
        const factor =
          base / Math.max(resizeInfo.startW, resizeInfo.startH, 1);
        const t = texts[resizeInfo.index];
        t.fontSize = resizeInfo.fontSize * factor;
      }
      redraw();
    }
    if (isErasing) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      eraseAt(worldPos.x, worldPos.y);
    }
  }

  function handlePointerUp(e) {
    if (isDrawing || isPanning || isDraggingObject || isResizingObject || isErasing) {
      e.preventDefault();
    }

    if (isDrawing && activeStrokeId) {
      const stroke = strokes.find((s) => s.id === activeStrokeId);
    if (stroke && socketConnected) {
      socket.emit("stroke:add", { boardId, stroke });
    }
  }

    // リサイズが終わった時点で、テキストのフォントサイズをデフォルトに反映
    if (isResizingObject && resizeInfo && selected) {
      if (resizeInfo.type === "text" && selected.type === "text") {
        const t = texts[selected.index];
        textDefaultFontSizeWorld = t.fontSize;
      }
    }

    // 移動・リサイズを共有
    if (socketConnected && selected) {
      if (isDraggingObject) {
        if (selected.type === "image") {
          const imgObj = images[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "image",
            id: imgObj.id,
            patch: { x: imgObj.x, y: imgObj.y },
          });
        } else if (selected.type === "text") {
          const t = texts[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "text",
            id: t.id,
            patch: { x: t.x, y: t.y },
          });
        }
      }
      if (isResizingObject) {
        if (selected.type === "image") {
          const imgObj = images[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "image",
            id: imgObj.id,
            patch: { width: imgObj.width, height: imgObj.height },
          });
        } else if (selected.type === "text") {
          const t = texts[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "text",
            id: t.id,
            patch: { fontSize: t.fontSize },
          });
        }
      }
    }

    isDrawing = false;
    isPanning = false;
    isDraggingObject = false;
    isResizingObject = false;
    isErasing = false;
    activeStrokeId = null;
    resizeInfo = null;

    // 注目モード解除チェック
    if (attentionActive && !(e.ctrlKey && e.altKey && e.shiftKey)) {
      endAttention();
    }
  }

  // --- ズーム ---
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const canvasPos = getCanvasPointFromEvent(e);
    lastMouseScreen = { x: canvasPos.x, y: canvasPos.y };

    const before = screenToWorld(canvasPos.x, canvasPos.y);
    const delta = -e.deltaY * 0.001;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));
    const afterScreenX = before.x * scale + offsetX;
    const afterScreenY = before.y * scale + offsetY;
    offsetX += canvasPos.x - afterScreenX;
    offsetY += canvasPos.y - afterScreenY;
    redraw();
  });

  // --- ドラッグ＆ドロップ（画像） ---
  canvas.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);
    if (!e.dataTransfer || !e.dataTransfer.files) return;

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type && file.type.startsWith("image/")) {
        addImageFile(file, worldPos.x, worldPos.y);
      }
    }
  });

  // --- クリップボード貼り付け ---
  window.addEventListener("paste", (e) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    const items = clipboard.items ? Array.from(clipboard.items) : [];
    const rect = canvas.getBoundingClientRect();
    const sx = lastMouseScreen.x || rect.width / 2;
    const sy = lastMouseScreen.y || rect.height / 2;
    const worldPos = screenToWorld(sx, sy);

    const imageItem = items.find(
      (it) => it.type && it.type.startsWith("image/")
    );
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        addImageFile(file, worldPos.x, worldPos.y);
      }
      return;
    }

    const text = clipboard.getData("text");
    if (text) {
      e.preventDefault();
      if (!requireUser()) return;
      addTextFromClipboard(text, worldPos.x, worldPos.y);
    }
  });

  // --- イベント登録 ---
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", handlePointerDown);
  canvas.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("mousemove", (e) => {
    if (!attentionActive) return;
    const canvasPos = getCanvasPointFromEvent(e);
    const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
    const color = getCurrentFavoriteColor();
    attentionPointers.set(currentUser, {
      x: worldPos.x,
      y: worldPos.y,
      color,
      updatedAt: Date.now(),
    });
    ensureAttentionAnimation();
    if (socketConnected) {
      socket.emit("attention:update", {
        boardId,
        data: { user: currentUser, x: worldPos.x, y: worldPos.y, color },
      });
    }
    redraw();
  });

  window.addEventListener("keydown", (e) => {
    // 注目（レーザーポインター）開始
    if (e.ctrlKey && e.altKey && e.shiftKey && !attentionActive) {
      if (!requireUser()) return;
      attentionActive = true;
      const canvasPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const color = getCurrentFavoriteColor();
      attentionPointers.set(currentUser, {
        x: worldPos.x,
        y: worldPos.y,
        color,
        updatedAt: Date.now(),
      });
      ensureAttentionAnimation();
      if (socketConnected) {
        socket.emit("attention:start", {
          boardId,
          data: { user: currentUser, x: worldPos.x, y: worldPos.y, color },
        });
      }
      canvas.classList.add("attention-cursor");
      redraw();
      return;
    }

    if (textEditor) return;

    // 入力系のUIを操作中ならスキップ
    const target = e.target;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    // Delete/Backspace: 画像のみ削除
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selected &&
      selected.type === "image"
    ) {
      e.preventDefault();
      deleteSelectedImage();
      return;
    }

    const isPrintable =
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    const isEnter = e.key === "Enter";
    if (!isPrintable && !isEnter) return;

    // 選択モード → クリックした座標を待つ。ペンモード → マウス位置から開始。
    let pos = pendingTextPos;
    if (!pos && currentTool === "pen") {
      const rect = canvas.getBoundingClientRect();
      const x = lastMouseScreen.x || rect.width / 2;
      const y = lastMouseScreen.y || rect.height / 2;
      pos = { x, y };
    }
    if (!pos) return;
    if (!requireUser()) return;

    const initialChar = isPrintable ? e.key : "";
    e.preventDefault();
    createTextEditorAt(pos.x, pos.y, initialChar);
    pendingTextPos = null;
  });

  window.addEventListener("keyup", (e) => {
    if (attentionActive && !(e.ctrlKey && e.altKey && e.shiftKey)) {
      endAttention();
    }
  });

  window.addEventListener("blur", () => {
    if (attentionActive) {
      // 少し猶予をもって終了
      clearTimeout(attentionTimeout);
      attentionTimeout = setTimeout(endAttention, ATTENTION_TIMEOUT_MS / 2);
    }
  });

  canvas.addEventListener("touchstart", handlePointerDown, { passive: false });
  canvas.addEventListener("touchmove", handlePointerMove, { passive: false });
  canvas.addEventListener("touchend", handlePointerUp);
  canvas.addEventListener("touchcancel", handlePointerUp);

  // --- UIイベント ---

  function updateToolButtons() {
    penToolBtn.disabled = currentTool === "pen";
    eraserToolBtn.disabled = currentTool === "eraser";
    selectToolBtn.disabled = currentTool === "select";
    if (currentTool === "pen" || currentTool === "eraser") {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "default";
    }
  }
  updateToolButtons();

  // --- ユーザーモーダル ---
  userJoinBtn.addEventListener("click", () => {
    const name = userNameInput.value.trim();
    if (!name) return;
    setCurrentUser(name);
    closeUserModal();
  });

  userNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      userJoinBtn.click();
    }
  });

  // 色変更処理（テキスト選択中なら、その色も変える＆記憶する）
  function applyNewColor(newColor) {
    currentColor = newColor;

    // テキストが選択されている場合は、そのテキストの色を変更
    if (selected && selected.type === "text") {
      const t = texts[selected.index];
      t.color = newColor;
      textDefaultColor = newColor; // 「最後に使った文字色」として記憶
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: t.id,
          patch: { color: t.color },
        });
      }
      redraw();
    }

    const isTextSelected = selected && selected.type === "text";
    if (
      !isTextSelected &&
      (currentTool === "select" || currentTool === "eraser")
    ) {
      currentTool = "pen";
      selected = null;
      updateToolButtons();
    }
  }

  function undoLast() {
    if (!requireUser()) return;
    let last = null;
    strokes.forEach((s, idx) => {
      if (s.user !== currentUser) return;
      const ord = typeof s.order === "number" ? s.order : -Infinity;
      if (last === null || ord > last.order) last = { type: "stroke", index: idx, order: ord };
    });
    texts.forEach((t, idx) => {
      if (t.user !== currentUser) return;
      const ord = typeof t.order === "number" ? t.order : -Infinity;
      if (last === null || ord > last.order) last = { type: "text", index: idx, order: ord };
    });
    images.forEach((img, idx) => {
      if (img.user !== currentUser) return;
      const ord = typeof img.order === "number" ? img.order : -Infinity;
      if (last === null || ord > last.order) last = { type: "image", index: idx, order: ord };
    });

    if (!last) return;
    let removed = null;
    if (last.type === "stroke") {
      removed = strokes.splice(last.index, 1)[0];
    } else if (last.type === "text") {
      removed = texts.splice(last.index, 1)[0];
      refreshTextList();
    } else if (last.type === "image") {
      removed = images.splice(last.index, 1)[0];
    }
    if (removed && socketConnected) {
      socket.emit("item:remove", { boardId, type: last.type, id: removed.id });
    }
    selected = null;
    redraw();
  }

  colorPicker.addEventListener("input", () => {
    const c = colorPicker.value;
    swatches.forEach((btn) => btn.classList.remove("selected"));
    applyNewColor(c);
  });

  swatches.forEach((btn) => {
    const c = btn.getAttribute("data-color");
    btn.style.backgroundColor = c;
    btn.addEventListener("click", () => {
      colorPicker.value = c;
      swatches.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      applyNewColor(c);
    });
  });
  // デフォルトカラーにチェック
  swatches[0].classList.add("selected");

  favButtons.forEach((btn) => {
    const c = btn.getAttribute("data-color");
    btn.addEventListener("click", () => {
      if (!requireUser()) return;
      const currentFav = favoritesByUser[currentUser];
      if (currentFav === c) {
        delete favoritesByUser[currentUser];
      } else {
        favoritesByUser[currentUser] = c;
      }
      saveFavorites();
      updateFavButtons();
    });
  });

  sizeRange.addEventListener("input", () => {
    currentSize = parseInt(sizeRange.value, 10);
    sizeLabel.textContent = currentSize;
  });

  penToolBtn.addEventListener("click", () => {
    currentTool = "pen";
    selected = null;
    updateToolButtons();
    redraw();
  });

  eraserToolBtn.addEventListener("click", () => {
    if (!requireUser()) return;
    currentTool = "eraser";
    selected = null;
    updateToolButtons();
  });

  selectToolBtn.addEventListener("click", () => {
    currentTool = "select";
    updateToolButtons();
  });

  textListBtn.addEventListener("click", () => {
    if (textListOpen) {
      closeTextList();
    } else {
      openTextList();
    }
  });

  textListCloseBtn.addEventListener("click", () => {
    closeTextList();
  });

  strokeAlphaToggleBtn.addEventListener("click", () => {
    strokesDimmed = !strokesDimmed;
    strokeAlphaToggleBtn.textContent = strokesDimmed ? "半透明解除" : "半透明";
    redraw();
  });

  templateSelect.addEventListener("change", () => {
    const src = templateSelect.value;
    if (!src) return;
    if (!requireUser()) return;
    const rect = canvas.getBoundingClientRect();
    const sx = lastMouseScreen.x || rect.width / 2;
    const sy = lastMouseScreen.y || rect.height / 2;
    const worldPos = screenToWorld(sx, sy);
    addTemplateImage(src, worldPos.x, worldPos.y);
    templateSelect.value = "";
  });

  boardTitleLabel.addEventListener("click", () => {
    const newTitle = window.prompt("ボード名を入力", boardTitle);
    if (newTitle === null) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === boardTitle) return;
    boardTitle = trimmed;
    updateBoardTitleDisplay();
    if (socketConnected) {
      socket.emit("board:title:update", { boardId, title: boardTitle });
    }
  });
  // Undo（最後に追加したテキスト/ペン/画像を取り消し）
  undoBtn.addEventListener("click", undoLast);

  // 初期化
  updateBoardTitleDisplay();
  refreshUserDatalist();
  loadTemplates();
  openUserModal();
})();
