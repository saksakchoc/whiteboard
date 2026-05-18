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
  const fillToolBtn = document.getElementById("fill-tool-btn");
  const eraserToolBtn = document.getElementById("eraser-tool-btn");
  const selectToolBtn = document.getElementById("select-tool-btn");
  const strokeAlphaToggleBtn = document.getElementById("stroke-alpha-toggle-btn");
  const toolbarEl = document.getElementById("toolbar");
  const insertMenuBtn = document.getElementById("insert-menu-btn");
  const insertMenu = document.getElementById("insert-menu");
  const textListBtn = document.getElementById("text-list-btn");
  const imageListBtn = document.getElementById("image-list-btn");
  const textListPanel = document.getElementById("text-list-panel");
  const textListBody = document.getElementById("text-list-body");
  const textListCloseBtn = document.getElementById("text-list-close-btn");
  const textListCopyTaggedBtn = document.getElementById("text-list-copy-tagged-btn");
  const textListCopyPlainBtn = document.getElementById("text-list-copy-plain-btn");
  const imageListPanel = document.getElementById("image-list-panel");
  const imageListBody = document.getElementById("image-list-body");
  const imageListCloseBtn = document.getElementById("image-list-close-btn");
  const otherMenuBtn = document.getElementById("other-menu-btn");
  const otherMenu = document.getElementById("other-menu");
  const changeUserBtn = document.getElementById("change-user-btn");
  const layerDisplay = document.getElementById("layer-display");
  const shapeLineBtn = document.getElementById("shape-line-btn");
  const shapeRectBtn = document.getElementById("shape-rect-btn");
  const shapeGridBtn = document.getElementById("shape-grid-btn");
  const undoBtn = document.getElementById("undo-btn");
  const contextMenu = document.getElementById("context-menu");
  const layerToggleBtn = document.getElementById("layer-toggle-btn");
  const footerHint = document.getElementById("footer-hint");
  const imageFileInput = document.getElementById("image-file-input");
  const swatches = Array.from(document.querySelectorAll(".color-swatch"));
  const favButtons = Array.from(document.querySelectorAll(".color-fav"));
  const menuToggleBtn = document.getElementById("menu-toggle-btn");
  const userModal = document.getElementById("user-modal");
  const userNameInput = document.getElementById("user-name-input");
  const userDatalist = document.getElementById("user-datalist");
  const userJoinBtn = document.getElementById("user-join-btn");

  const ctx = canvas.getContext("2d");

  // --- ボードID表示 ---
  const boardId = window.location.pathname.split("/").pop();
  const userStorageKey = `board-users-${boardId}`;
  const lastUserStorageKey = `last-user-${boardId}`;
  let boardTitle = boardId;
  const favoriteStorageKey = `favorites-${boardId}`;
  const paletteStorageKey = `palette-${boardId}`;
  const userProfileStorageKey = "user-profiles-v1";
  let favoritesByUser = loadFavorites();
  let paletteColors = loadPalette();
  let userProfiles = loadUserProfiles();

  // --- 状態 ---
  // ペン用の現在色
  let currentColor = "#000000";
  let activeColorSwatch = null;
  let currentSize = parseInt(sizeRange.value, 10);
  let currentTool = "pen"; // "pen" | "fill" | "select" | "eraser"
  let currentUser = "";
  let knownUsers = [];
  let boardUsersFromServer = [];
  let strokesDimmed = false;
  const DIM_ALPHA = 0.35;
  let attentionActive = false;
  const attentionPointers = new Map(); // user -> {x,y,color,updatedAt}
  let attentionTimeout = null;
  let attentionAnimRaf = null;
  let activeLayer = "user"; // "user" | "base" | "image" | "draft" | "admin"
  let lastUserLayerTool = "pen";
  let selectionDragActive = false;
  let isSelectingArea = false;
  let selectionDragStart = null;
  let selectionDragCurrent = null;
  let multiSelection = null;
  let multiDragActive = false;
  let multiDragStartWorld = null;
  let multiDragOffsets = null;
  let rightButtonDown = false;
  let rightButtonStart = null;
  const CONTEXT_DRAG_THRESHOLD = 6;
  let footerMessage = "";
  let footerMessageTimer = null;
  const MAX_HINT_DURATION = 15000;
  let shapeMode = null; // "line" | "rect" | "grid" | null
  let shapeStart = null;
  let shapePreview = null;
  let isDrawingShape = false;
  let shapeGridRows = 0;
  let shapeGridCols = 0;
  let shapeTargetLayer = null;
  let insertMenuHideTimer = null;
  let ignoreNextDblClick = false;
  let activeCtrlSide = null; // "left" | "right" | null
  let pendingImageInsertLayer = null;

  function getSquareBoundsFromDrag(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const side = Math.min(Math.abs(dx), Math.abs(dy));
    const x1 = start.x + (dx < 0 ? -side : side);
    const y1 = start.y + (dy < 0 ? -side : side);
    return {
      x0: Math.min(start.x, x1),
      y0: Math.min(start.y, y1),
      x1: Math.max(start.x, x1),
      y1: Math.max(start.y, y1),
      side,
    };
  }

  function normalizeRotation(rotation = 0) {
    return ((rotation % 360) + 360) % 360;
  }

  function getRectCenter(rect) {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  function rotatePointAround(point, center, direction) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    if (direction === "cw") {
      return { x: center.x + dy, y: center.y - dx };
    }
    return { x: center.x - dy, y: center.y + dx };
  }

  function rotatePointByDegrees(point, center, degrees) {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  }

  function pointInRotatedRectWorld(point, rect, rotation = 0) {
    const center = getRectCenter(rect);
    const local = rotatePointByDegrees(point, center, -normalizeRotation(rotation));
    return pointInRectWorld(rect, local);
  }

  function getRotatedRectCornersWorld(rect, rotation = 0) {
    const center = getRectCenter(rect);
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ].map((p) => rotatePointByDegrees(p, center, normalizeRotation(rotation)));
  }

  // テキストの「デフォルト色＆サイズ」（最後に使った文字の色と大きさを記憶）
  let textDefaultColor = "#000000";
  let textDefaultFontSizeWorld = 16; // ホワイトボード座標系でのフォントサイズ

  // 図形データ
  const strokes = []; // { id, color, size, points: [{x,y}], user, order }
  const images = [];  // { id, img, src, x, y, width, height, layer: "base", order }
  const texts = [];   // { id, lines:[string], x, y, fontSize, color, user, order, createdAt, label }
  const draftStrokes = []; // { id, color, size, points, user, order, createdAt }
  let textListOpen = false;
  let imageListOpen = false;
  let imageListOrderCounter = 0;

  // ズーム・パン
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 4.0;

  // 状態フラグ
  let isDrawing = false;
  let isDrawingDraft = false;
  let isPanning = false;
  let isDraggingObject = false;
  let isResizingObject = false;
  let isErasing = false;
  let pendingTextPos = null;
  let activeStrokeId = null;
  let activeDraftId = null;

  let lastPan = { x: 0, y: 0 };
  let lastMouseScreen = { x: 0, y: 0 };
  let pinchActive = false;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchStartMid = null;
  let pinchStartOffset = { x: 0, y: 0 };
  let templates = [];
  const ATTENTION_TIMEOUT_MS = 10000;
  const historyStack = [];
  const MAX_HISTORY = 80;
  let actionSnapshotTaken = false;
  let framePlaceType = null; // "omoteura" | "free" | null
  let framePlaceStart = null;
  let framePlacePreview = null;
  let frameCounter = 1;
  let isPlacingFrame = false;
  let compactMode = false;
  let menuVisible = true;

  // 選択中オブジェクト
  // selected = { type: "image"|"text", index: number } or null
  let selected = null;
  let dragOffsetWorld = { x: 0, y: 0 };
  let resizeInfo = null; // { type, index, originX, originY, startW, startH, fontSize }

  // テキスト入力用（HTMLの textarea オーバーレイ）
  let textEditor = null;
  let orderCounter = 0; // 描画優先順位（ペンとテキストで共有）
  let draftOrderCounter = 0;
  let draftsLoaded = false;

  // --- 色ユーティリティ ---
  function normalizeHexColor(color) {
    if (typeof color !== "string") return "#000000";
    if (!color.startsWith("#")) return color;
    const raw = color.slice(1);
    if (raw.length === 3) {
      return (
        "#" +
        raw
          .split("")
          .map((c) => c + c)
          .join("")
          .toLowerCase()
      );
    }
    if (raw.length === 6) {
      return `#${raw.toLowerCase()}`;
    }
    return color;
  }

  function lightenColor(color, ratio = 0.18) {
    const normalized = normalizeHexColor(color);
    if (!normalized.startsWith("#") || normalized.length !== 7) return color;
    const num = parseInt(normalized.slice(1), 16);
    if (Number.isNaN(num)) return color;
    const mix = (v) => Math.round(v + (255 - v) * ratio);
    const r = mix((num >> 16) & 255);
    const g = mix((num >> 8) & 255);
    const b = mix(num & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  function getTextStrokeWidths(fontSizePx) {
    const outer = Math.max(1, fontSizePx * 0.15);
    return { outer };
  }

  function cloneState() {
    const clonePoints = (pts = []) => pts.map((p) => ({ x: p.x, y: p.y }));
    const cloneStrokes = (arr) =>
      arr.map((s) => ({
        ...s,
        points: clonePoints(s.points),
      }));
    const cloneTexts = (arr) => arr.map((t) => ({ ...t, lines: t.lines ? [...t.lines] : [] }));
    const cloneImages = (arr) =>
      arr.map((img) => ({
        id: img.id,
        src: img.src,
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        layer: img.layer,
        order: img.order,
        user: img.user,
      }));

    return {
      strokes: cloneStrokes(strokes),
      texts: cloneTexts(texts),
      images: cloneImages(images),
      draftStrokes: cloneStrokes(draftStrokes),
      orderCounter,
      draftOrderCounter,
      activeLayer,
      scale,
      offsetX,
      offsetY,
    };
  }

  function pushSnapshot() {
    historyStack.push(cloneState());
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    const rebuildImages = (arr = []) =>
      arr.map((img) => {
        const el = new Image();
        el.src = img.src;
        return {
          ...img,
          img: el,
        };
      });

    strokes.splice(0, strokes.length, ...(snap.strokes || []));
    texts.splice(0, texts.length, ...(snap.texts || []));
    images.splice(0, images.length, ...rebuildImages(snap.images || []));
    draftStrokes.splice(0, draftStrokes.length, ...(snap.draftStrokes || []));
    orderCounter = snap.orderCounter ?? orderCounter;
    draftOrderCounter = snap.draftOrderCounter ?? draftOrderCounter;
    activeLayer = snap.activeLayer ?? activeLayer;
    scale = snap.scale ?? scale;
    offsetX = snap.offsetX ?? offsetX;
    offsetY = snap.offsetY ?? offsetY;
    selected = null;
    multiSelection = null;
    isDrawing = false;
    isErasing = false;
    isDraggingObject = false;
    isResizingObject = false;
    shapeMode = null;
    textEditor && textEditor.remove();
    textEditor = null;
    actionSnapshotTaken = false;
    refreshTextList();
    updateLayerToggleUI();
    updateToolButtons();
    redraw();
  }

  function ensureSnapshotForAction() {
    if (actionSnapshotTaken) return;
    pushSnapshot();
    actionSnapshotTaken = true;
  }

  function buildTextShadow(baseColor, fontSizePx) {
    const { outer } = getTextStrokeWidths(fontSizePx);
    const blur = Math.max(1, outer * 0.7);
    return `0 0 ${blur}px #ffffff`;
  }

  function isStrokeVisible(stroke) {
    const layer = stroke.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return true; // すべて表示
    if (activeLayer === "user") return layer === "user" || layer === "base" || layer === "image";
    if (activeLayer === "base") return layer === "base" || layer === "image";
    if (activeLayer === "image") return layer === "image";
    return false;
  }

  function isTextVisible(text) {
    const layer = text.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return true; // すべて表示
    if (activeLayer === "user") return layer === "user" || layer === "base";
    if (activeLayer === "base") return layer === "base";
    if (activeLayer === "image") return false;
    return false;
  }

  function canInteractStroke(stroke) {
    const layer = stroke.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer === "draft" && stroke.user === currentUser;
    if (activeLayer === "user") return layer === "user";
    if (activeLayer === "base") return layer === "base";
    if (activeLayer === "image") return isAdminUser() && layer === "image";
    return false;
  }

  function canInteractText(text) {
    const layer = text.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer === "draft" && text.user === currentUser;
    if (activeLayer === "user") return layer === "user";
    if (activeLayer === "base") return layer === "base";
    return false;
  }

  function isImageVisible(imgObj) {
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return true;
    if (activeLayer === "image") return (imgObj?.layer || "image") === "image";
    if (activeLayer === "base") return (imgObj?.layer || "base") === "base" || (imgObj?.layer || "image") === "image";
    if (activeLayer === "user") return (imgObj?.layer || "user") === "user" || (imgObj?.layer || "base") === "base" || (imgObj?.layer || "image") === "image";
    return false;
  }

  function canInteractImage(imgObj = null) {
    if (activeLayer === "image" || activeLayer === "admin") return true;
    if (!imgObj) return false;
    const layer = imgObj.layer || "user";
    if (layer === "user" && activeLayer === "user" && imgObj.user === currentUser) {
      return true;
    }
    return false;
  }

  function withAlpha(color, alpha = 0.6) {
    const norm = normalizeHexColor(color);
    if (!norm.startsWith("#") || norm.length !== 7) return color;
    const r = parseInt(norm.slice(1, 3), 16);
    const g = parseInt(norm.slice(3, 5), 16);
    const b = parseInt(norm.slice(5, 7), 16);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // --- フッター ---
  function setFooterMessage(msg) {
    footerMessage = msg;
    if (footerHint) footerHint.textContent = footerMessage;
  }

  function showTransientFooterMessage(msg, durationMs = 4000) {
    const d = Math.min(durationMs, MAX_HINT_DURATION);
    setFooterMessage(msg);
    if (footerMessageTimer) {
      clearTimeout(footerMessageTimer);
    }
    footerMessageTimer = setTimeout(() => {
      footerMessageTimer = null;
      updateFooterByState();
    }, d);
  }

  function layerUserLabel() {
    if (isAdminUser()) return "Admin通常";
    return currentUser || "自分";
  }

  function updateLayerToggleUI() {
    const hasBtn = !!layerToggleBtn;
    const isImage = activeLayer === "image";
    const isAdmin = activeLayer === "admin";
    const labelText = (() => {
      if (isAdmin) return "Admin";
      if (isImage) return "画像(共用)";
      if (activeLayer === "base") return "ベース(共用)";
      if (activeLayer === "draft") return "下書き";
      return layerUserLabel();
    })();
    if (hasBtn) {
      if (isAdmin) {
        layerToggleBtn.textContent = "レイヤー: Admin";
      } else if (isImage) {
        layerToggleBtn.textContent = "レイヤー: 画像(共用)";
      } else if (activeLayer === "base") {
        layerToggleBtn.textContent = "レイヤー: ベースレイヤー(共用)";
      } else if (activeLayer === "draft") {
        layerToggleBtn.textContent = "レイヤー: 下書き";
      } else {
        layerToggleBtn.textContent = `レイヤー: ${layerUserLabel()}`;
      }
      layerToggleBtn.classList.toggle("is-image", isImage && !isAdmin);
    }
    if (layerDisplay) {
      layerDisplay.textContent = `Layer: ${labelText}`;
    }
  }

  function setActiveLayer(layer) {
    if (layer !== "user" && layer !== "base" && layer !== "image" && layer !== "admin" && layer !== "draft") return;
    if (activeLayer === layer) return;
    if (!isAdminUser() && (layer === "base" || layer === "image" || layer === "admin")) {
      showTransientFooterMessage("ベース/画像/Adminレイヤーは Admin のみ使用できます。", 4000);
      return;
    }

    if (layer === "image") {
      if (currentTool !== "select") {
        lastUserLayerTool = currentTool;
        currentTool = "select";
      }
      isDrawing = false;
      isErasing = false;
      isDraggingObject = false;
      isResizingObject = false;
      selected = null;
      multiSelection = null;
      pendingTextPos = null;
      selectionDragActive = false;
      isSelectingArea = false;
      updateToolButtons();
    } else {
      if (currentTool === "select") {
        currentTool = lastUserLayerTool || "pen";
      }
      isDrawing = false;
      isErasing = false;
      isDraggingObject = false;
      isResizingObject = false;
      selected = null;
      multiSelection = null;
      pendingTextPos = null;
      selectionDragActive = false;
      isSelectingArea = false;
      updateToolButtons();
    }

    activeLayer = layer;
    updateLayerToggleUI();
    const layerHints = {
      user: "通常レイヤー：描いたものは全員に見えます。",
      base: "ベースレイヤー(共用)：背景として共有されます。",
      image: "画像レイヤー：画像のみ操作できます。",
      draft: "下書きレイヤー：自分にだけ見えます。",
      admin: "Admin：全レイヤーを操作できます。",
    };
    const hint = layerHints[layer] || "";
    if (hint) showTransientFooterMessage(hint, 6000);
    redraw();
  }

  function toggleHiddenSharedLayer() {
    const nextLayer = activeLayer === "base" ? "image" : activeLayer === "image" ? "user" : "base";
    const prevUser = currentUser;
    if (!isAdminUser()) currentUser = "Admin";
    setActiveLayer(nextLayer);
    currentUser = prevUser;
    updateLayerToggleUI();
  }

  function toggleActiveLayer() {
    if (isAdminUser()) {
      if (activeLayer === "user") setActiveLayer("admin");
      else if (activeLayer === "admin") setActiveLayer("base");
      else if (activeLayer === "base") setActiveLayer("image");
      else if (activeLayer === "image") setActiveLayer("draft");
      else setActiveLayer("user");
    } else {
      // Admin 以外は「通常」と「下書き」のみ
      if (activeLayer === "user") setActiveLayer("draft");
      else setActiveLayer("user");
    }
  }

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
  function bumpDraftOrderCounter(orderValue) {
    if (typeof orderValue === "number") {
      draftOrderCounter = Math.max(draftOrderCounter, orderValue + 1);
    } else {
      draftOrderCounter += 1;
    }
    return draftOrderCounter;
  }

  function bumpImageListOrderCounter(orderValue) {
    if (typeof orderValue === "number") {
      imageListOrderCounter = Math.max(imageListOrderCounter, orderValue + 1);
    } else {
      imageListOrderCounter += 1;
    }
    return imageListOrderCounter;
  }

  // --- レイアウト計測 ---
  function updateToolbarMetrics() {
    if (!toolbarEl) return;
    const h = Math.max(52, toolbarEl.offsetHeight || 0);
    document.documentElement.style.setProperty("--top-toolbar-height", `${h}px`);
  }

  // --- キャンバスサイズ ---
  function resizeCanvas() {
    updateToolbarMetrics();
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }

  function shouldUseCompactMode() {
    return window.innerWidth <= 900;
  }

  function applyMenuVisibility() {
    if (!shouldUseCompactMode()) {
      compactMode = false;
      menuVisible = true;
      document.body.classList.remove("compact-mode", "menu-hidden");
      if (menuToggleBtn) {
        menuToggleBtn.classList.add("hidden");
        menuToggleBtn.textContent = ">";
        menuToggleBtn.setAttribute("aria-label", "メニューを表示");
      }
      resizeCanvas();
      return;
    }

    compactMode = true;
    document.body.classList.add("compact-mode");
    document.body.classList.toggle("menu-hidden", !menuVisible);
    if (menuToggleBtn) {
      menuToggleBtn.classList.remove("hidden");
      menuToggleBtn.textContent = menuVisible ? "×" : ">";
      menuToggleBtn.setAttribute(
        "aria-label",
        menuVisible ? "メニューを隠す" : "メニューを表示"
      );
    }
    resizeCanvas();
  }

  function refreshCompactMode() {
    const nextCompact = shouldUseCompactMode();
    if (nextCompact && !compactMode) {
      menuVisible = false;
    } else if (!nextCompact) {
      menuVisible = true;
    }
    applyMenuVisibility();
  }

  function hideMenusIfCompact() {
    if (compactMode && menuVisible) {
      menuVisible = false;
      applyMenuVisibility();
    }
  }

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

  function getPinchInfoFromTouches(touches) {
    if (!touches || touches.length < 2) return null;
    const rect = canvas.getBoundingClientRect();
    const p1 = {
      x: touches[0].clientX - rect.left,
      y: touches[0].clientY - rect.top,
    };
    const p2 = {
      x: touches[1].clientX - rect.left,
      y: touches[1].clientY - rect.top,
    };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return {
      distance: Math.hypot(dx, dy),
      mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    };
  }

  function commitDrawingIfNeeded() {
    if (!isDrawing) return;
    if (isDrawingDraft && activeDraftId) {
      const stroke = draftStrokes.find((s) => s.id === activeDraftId);
      if (stroke && socketConnected) {
        socket.emit("draft:stroke:add", { boardId, stroke });
      }
    } else if (activeStrokeId) {
      const stroke = strokes.find((s) => s.id === activeStrokeId);
      if (stroke && socketConnected) {
        socket.emit("stroke:add", { boardId, stroke });
      }
    }
    isDrawing = false;
    isDrawingDraft = false;
    activeStrokeId = null;
    activeDraftId = null;
  }

  function startPinchGesture(e) {
    const info = getPinchInfoFromTouches(e.touches);
    if (!info || !info.distance) return;
    closeMobileToolbarIfNeeded(e);
    commitDrawingIfNeeded();
    pinchActive = true;
    pinchStartDistance = info.distance;
    pinchStartScale = scale;
    pinchStartMid = info.mid;
    pinchStartOffset = { x: offsetX, y: offsetY };
    isPanning = false;
    isDraggingObject = false;
    isResizingObject = false;
    isErasing = false;
    selectionDragActive = false;
    isSelectingArea = false;
    multiSelection = null;
    e.preventDefault();
  }

  function handlePinchMove(e) {
    if (!pinchActive) return;
    const info = getPinchInfoFromTouches(e.touches);
    if (!info || !info.distance || pinchStartDistance === 0) return;
    e.preventDefault();
    const scaleFactor = info.distance / pinchStartDistance;
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, pinchStartScale * scaleFactor)
    );
    const worldAtStartMid = {
      x: (pinchStartMid.x - pinchStartOffset.x) / pinchStartScale,
      y: (pinchStartMid.y - pinchStartOffset.y) / pinchStartScale,
    };
    scale = nextScale;
    offsetX = info.mid.x - worldAtStartMid.x * scale;
    offsetY = info.mid.y - worldAtStartMid.y * scale;
    redraw();
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

  function loadPalette() {
    try {
      const raw = localStorage.getItem(paletteStorageKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((c) => typeof c === "string") : [];
    } catch {
      return [];
    }
  }

  function savePalette() {
    try {
      localStorage.setItem(paletteStorageKey, JSON.stringify(paletteColors));
    } catch {
      // ignore
    }
  }

  function loadUserProfiles() {
    try {
      const raw = localStorage.getItem(userProfileStorageKey);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function saveUserProfiles() {
    try {
      localStorage.setItem(userProfileStorageKey, JSON.stringify(userProfiles || {}));
    } catch {
      // ignore
    }
  }

  function getProfileFavoriteColor(name) {
    if (!name) return null;
    return userProfiles?.[name]?.favoriteColor || null;
  }

  function setProfileFavoriteColor(name, color) {
    if (!name || !color) return;
    userProfiles = userProfiles || {};
    const prev = userProfiles[name] || {};
    userProfiles[name] = { ...prev, favoriteColor: color };
    saveUserProfiles();
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

  function loadLastUser() {
    try {
      return localStorage.getItem(lastUserStorageKey) || "";
    } catch {
      return "";
    }
  }

  function saveLastUser(name) {
    if (!name) return;
    try {
      localStorage.setItem(lastUserStorageKey, name);
    } catch {
      // ignore storage errors
    }
  }

  function collectKnownUsers() {
    const set = new Set();
    loadStoredUsers().forEach((u) => set.add(u));
    boardUsersFromServer.forEach((u) => set.add(u));
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
    const favColor = favoritesByUser[currentUser] || getProfileFavoriteColor(currentUser);
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

  function setPaletteItemColor(swatch, color) {
    if (!swatch || !color) return;
    const normalized = normalizeHexColor(color);
    const oldColor = swatch.getAttribute("data-color");
    const item = swatch.closest(".color-item");
    const favBtn = item?.querySelector(".color-fav");
    const index = swatches.indexOf(swatch);

    swatch.setAttribute("data-color", normalized);
    swatch.style.backgroundColor = normalized;
    swatch.title = normalized;

    if (favBtn) {
      favBtn.setAttribute("data-color", normalized);
      favBtn.title = "お気に入り";
    }

    if (index >= 0) {
      paletteColors[index] = normalized;
      savePalette();
    }

    const currentFav = currentUser ? favoritesByUser[currentUser] || getProfileFavoriteColor(currentUser) : null;
    if (currentUser && oldColor && currentFav === oldColor) {
      favoritesByUser[currentUser] = normalized;
      setProfileFavoriteColor(currentUser, normalized);
      saveFavorites();
    }
    updateFavButtons();
  }

  function getActiveColorSwatch() {
    return activeColorSwatch || swatches.find((btn) => btn.classList.contains("selected")) || swatches[0] || null;
  }

  function getCurrentFavoriteColor() {
    return favoritesByUser[currentUser] || getProfileFavoriteColor(currentUser) || "#ff3b30"; // デフォルト赤
  }

  function createSideTag(type) {
    const spec =
      type === "omote"
        ? {
            body: "#fff8ce",
            header: "#ffd966",
            text: "表",
            textColor: "#8a5b00",
          }
        : {
            body: "#e6f3ff",
            header: "#b7d5ff",
            text: "裏",
            textColor: "#0f4f9b",
          };
    const w = 360;
    const h = 140;
    const headerH = 32;
    const canvasTag = document.createElement("canvas");
    canvasTag.width = w;
    canvasTag.height = h;
    const c = canvasTag.getContext("2d");
    c.fillStyle = spec.body;
    c.fillRect(0, 0, w, h);
    c.fillStyle = spec.header;
    c.fillRect(0, 0, w, headerH);
    c.fillStyle = spec.textColor;
    c.font = "20px sans-serif";
    c.textBaseline = "middle";
    c.textAlign = "left";
    c.fillText(spec.text, 14, headerH / 2);
    return canvasTag.toDataURL("image/png");
  }

  function createFrameTag(type, width, height, label = "", colors = null) {
    const minW = 120;
    const minH = 80;
    const w = Math.max(minW, Math.abs(width));
    const h = Math.max(minH, Math.abs(height));
    if (type === "omoteura") {
      return createOmoteUraFrameTag(w, h);
    }
    const spec =
      type === "omote"
        ? {
            body: "#fff8ce",
            header: "#ffd966",
            text: label || "表",
            textColor: "#8a5b00",
          }
        : type === "ura"
        ? {
            body: "#e6f3ff",
            header: "#b7d5ff",
            text: label || "裏",
            textColor: "#0f4f9b",
          }
        : {
            body: colors?.body || lightenColor(currentColor, 0.35),
            header: colors?.header || lightenColor(currentColor, 0.15),
            text: label || "フレーム",
            textColor: colors?.text || "#1c1c1c",
          };
    const headerH = Math.min(Math.max(24, h * 0.25), 40);
    const canvasTag = document.createElement("canvas");
    canvasTag.width = w;
    canvasTag.height = h;
    const c = canvasTag.getContext("2d");
    c.fillStyle = spec.body;
    c.fillRect(0, 0, w, h);
    c.fillStyle = spec.header;
    c.fillRect(0, 0, w, headerH);
    c.fillStyle = spec.textColor;
    c.font = "18px sans-serif";
    c.textBaseline = "middle";
    c.textAlign = "left";
    drawFittedText(c, spec.text, 12, headerH / 2, w - 24);
    return canvasTag.toDataURL("image/png");
  }

  function getOmoteUraFrameColors() {
    return {
      omoteBody: "#fff0e7",
      omoteBar: "#e85d2a",
      uraBody: "#e5f7ff",
      uraBar: "#0896c7",
      border: "#24313a",
      text: "#17232b",
    };
  }

  function createOmoteUraFrameTag(width, height) {
    const w = Math.max(120, Math.abs(width));
    const h = Math.max(80, Math.abs(height));
    const colors = getOmoteUraFrameColors();
    const barW = Math.min(28, Math.max(18, w * 0.1));
    const midY = h / 2;
    const canvasTag = document.createElement("canvas");
    canvasTag.width = w;
    canvasTag.height = h;
    const c = canvasTag.getContext("2d");

    c.fillStyle = colors.omoteBody;
    c.fillRect(0, 0, w, midY);
    c.fillStyle = colors.uraBody;
    c.fillRect(0, midY, w, h - midY);
    c.fillStyle = colors.omoteBar;
    c.fillRect(0, 0, barW, midY);
    c.fillStyle = colors.uraBar;
    c.fillRect(0, midY, barW, h - midY);
    c.strokeStyle = colors.border;
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);

    c.fillStyle = colors.text;
    c.font = "18px sans-serif";
    c.textBaseline = "middle";
    c.textAlign = "center";
    c.fillText("表", barW / 2, midY / 2);
    c.fillText("裏", barW / 2, midY + (h - midY) / 2);
    return canvasTag.toDataURL("image/png");
  }

  function getFrameHeaderHeightWorld(imgObj) {
    const worldH = Math.max(1, Math.abs(imgObj?.height || 0));
    return Math.min(Math.max(24, worldH * 0.25), 40);
  }

  function getFrameTagColors(imgObj) {
    if (imgObj?.tagColors) return imgObj.tagColors;
    if (imgObj?.tagType === "omoteura") return getOmoteUraFrameColors();
    const fallback =
      imgObj?.tagType === "omote"
        ? { body: "#fff8ce", header: "#ffd966", text: "#8a5b00" }
        : imgObj?.tagType === "ura"
        ? { body: "#e6f3ff", header: "#b7d5ff", text: "#0f4f9b" }
        : {
            body: lightenColor(currentColor, 0.35),
            header: lightenColor(currentColor, 0.15),
            text: "#1c1c1c",
          };
    const imgEl = imgObj?.img;
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return fallback;

    try {
      const sample = document.createElement("canvas");
      sample.width = imgEl.naturalWidth;
      sample.height = imgEl.naturalHeight;
      const sampleCtx = sample.getContext("2d");
      sampleCtx.drawImage(imgEl, 0, 0);
      const sourceHeaderH = Math.min(Math.max(24, imgEl.naturalHeight * 0.25), 40);
      const toRgb = (data) => `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
      const header = sampleCtx.getImageData(1, 1, 1, 1).data;
      const bodyY = Math.min(imgEl.naturalHeight - 1, Math.ceil(sourceHeaderH) + 1);
      const body = sampleCtx.getImageData(1, bodyY, 1, 1).data;
      imgObj.tagColors = { ...fallback, body: toRgb(body), header: toRgb(header) };
      return imgObj.tagColors;
    } catch {
      return fallback;
    }
  }

  function drawFrameTagImage(ctx, imgObj, _p, _w, _h, rotation) {
    if (imgObj.tagType === "omoteura") {
      drawOmoteUraFrameImage(ctx, imgObj, rotation);
      return;
    }
    const colors = getFrameTagColors(imgObj);
    const worldW = imgObj.width;
    const worldH = imgObj.height;
    const headerH = Math.min(getFrameHeaderHeightWorld(imgObj), worldH);
    const label =
      imgObj.tagLabel || (imgObj.tagType === "omote" ? "表" : imgObj.tagType === "ura" ? "裏" : "フレーム");

    ctx.save();
    const screenPos = worldToScreen(imgObj.x, imgObj.y);
    ctx.translate(screenPos.x, screenPos.y);
    ctx.scale(scale, scale);
    if (rotation) {
      ctx.translate(worldW / 2, worldH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-worldW / 2, -worldH / 2);
    }
    ctx.fillStyle = colors.body;
    ctx.fillRect(0, 0, worldW, worldH);
    ctx.fillStyle = colors.header;
    ctx.fillRect(0, 0, worldW, headerH);
    ctx.fillStyle = colors.text;
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    drawFittedText(ctx, label, 12, headerH / 2, Math.max(0, worldW - 24));
    ctx.restore();
  }

  function drawOmoteUraFrameImage(ctx, imgObj, rotation) {
    const colors = getOmoteUraFrameColors();
    const worldW = imgObj.width;
    const worldH = imgObj.height;
    const barW = Math.min(28, Math.max(18, worldW * 0.1));
    const midY = worldH / 2;

    ctx.save();
    const screenPos = worldToScreen(imgObj.x, imgObj.y);
    ctx.translate(screenPos.x, screenPos.y);
    ctx.scale(scale, scale);
    if (rotation) {
      ctx.translate(worldW / 2, worldH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-worldW / 2, -worldH / 2);
    }

    ctx.fillStyle = colors.omoteBody;
    ctx.fillRect(0, 0, worldW, midY);
    ctx.fillStyle = colors.uraBody;
    ctx.fillRect(0, midY, worldW, worldH - midY);
    ctx.fillStyle = colors.omoteBar;
    ctx.fillRect(0, 0, barW, midY);
    ctx.fillStyle = colors.uraBar;
    ctx.fillRect(0, midY, barW, worldH - midY);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, Math.max(0, worldW - 2), Math.max(0, worldH - 2));

    ctx.fillStyle = colors.text;
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("表", barW / 2, midY / 2);
    ctx.fillText("裏", barW / 2, midY + (worldH - midY) / 2);
    ctx.restore();
  }

  function drawFittedText(ctx, text, x, y, maxWidth) {
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) {
      ctx.fillText(value, x, y);
      return;
    }

    const ellipsis = "...";
    let fitted = value;
    while (fitted.length > 0 && ctx.measureText(`${fitted}${ellipsis}`).width > maxWidth) {
      fitted = fitted.slice(0, -1);
    }
    ctx.fillText(fitted ? `${fitted}${ellipsis}` : ellipsis, x, y);
  }

  function getFrameHeaderBoundsWorld(imgObj) {
    if (!imgObj || !imgObj.tagType) return null;
    return {
      x: imgObj.x,
      y: imgObj.y,
      width: imgObj.width,
      height: Math.min(imgObj.height, getFrameHeaderHeightWorld(imgObj)),
    };
  }

  function canEditFrameLabel(imgObj) {
    if (!imgObj?.tagType) return false;
    if (imgObj.tagType === "omoteura") return false;
    if (activeLayer === "image" || activeLayer === "admin") return true;
    return false;
  }

  function hitTestFrameLabel(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canEditFrameLabel(imgObj)) continue;
      const header = getFrameHeaderBoundsWorld(imgObj);
      if (!header) continue;
      if (pointInRotatedRectWorld(worldPoint, header, imgObj.rotation || 0)) return i;
    }
    return -1;
  }

  function editFrameLabelAt(index) {
    const imgObj = images[index];
    if (!imgObj || !imgObj.tagType) return false;
    if (imgObj.tagType === "omoteura") return false;
    const current = imgObj.tagLabel || (imgObj.tagType === "omote" ? "表" : imgObj.tagType === "ura" ? "裏" : "フレーム");
    const next = window.prompt("フレーム名を入力", current);
    if (next === null) return true;
    const label = next.trim() || current;
    imgObj.tagLabel = label;
    refreshFrameImageForCurrentSize(imgObj, { emit: true });
    return true;
  }

  function refreshFrameImageForCurrentSize(imgObj, { emit = false } = {}) {
    if (!imgObj?.tagType) return false;
    const label =
      imgObj.tagLabel ||
      (imgObj.tagType === "omoteura"
        ? "表裏"
        : imgObj.tagType === "omote"
        ? "表"
        : imgObj.tagType === "ura"
        ? "裏"
        : "フレーム");
    const pixelW = Math.max(120, Math.round(Math.abs(imgObj.width) * scale));
    const pixelH = Math.max(80, Math.round(Math.abs(imgObj.height) * scale));
    const colors = getFrameTagColors(imgObj);
    const dataUrl = createFrameTag(imgObj.tagType || "free", pixelW, pixelH, label, colors);
    const img = new Image();
    img.onload = () => {
      imgObj.img = img;
      imgObj.src = dataUrl;
      imgObj.tagLabel = label;
      if (emit && socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "image",
          id: imgObj.id,
          patch: {
            src: imgObj.src,
            width: imgObj.width,
            height: imgObj.height,
            tagLabel: imgObj.tagLabel,
            tagType: imgObj.tagType,
          },
        });
      }
      redraw();
    };
    img.src = dataUrl;
    return true;
  }

  function sortTextsByCreated() {
    return texts
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function linkifyText(str) {
    if (!str) return "";
    const escaped = escapeHtml(str);
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return escaped.replace(
      urlRegex,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    ).replace(/\n/g, "<br>");
  }

  function openTextList() {
    textListOpen = true;
    textListPanel.classList.remove("hidden");
    positionTextListPanel();
    renderTextList();
  }

  function closeTextList() {
    textListOpen = false;
    textListPanel.classList.add("hidden");
    textListPanel.style.maxHeight = "";
    if (textListBody) textListBody.style.maxHeight = "";
    textListPanel.style.top = "";
    textListPanel.style.bottom = "";
  }

  function renderTextList() {
    if (!textListOpen) return;
    textListBody.innerHTML = "";
    const sorted = sortTextsByCreated();
    sorted.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "text-list-item";
      if (t.layer === "draft") {
        // 下書きは一覧に表示しない
        return;
      }
      item.dataset.id = t.id;

      const labelRow = document.createElement("div");
      labelRow.className = "text-label-row";
      const meta = document.createElement("span");
      meta.className = "text-list-meta";
      meta.textContent = `#${idx + 1}`;
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

      labelRow.appendChild(meta);
      labelRow.appendChild(labelBadge);

      const content = document.createElement("div");
      content.className = "text-list-content";
      content.innerHTML = linkifyText(t.lines.join("\n"));

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
    positionTextListPanel();
  }

  function buildTextListPlainText() {
    const list = sortTextsByCreated().filter((t) => t.layer !== "draft");
    if (!list.length) return "";
    return list
      .map((t) => (t.lines || []).join("\n"))
      .join("\n\n");
  }

  function buildTextListTaggedText() {
    const list = sortTextsByCreated().filter((t) => t.layer !== "draft");
    if (!list.length) return "";
    return list
      .map((t) => {
        const label = (t.label && t.label.trim()) || "(ラベルなし)";
        const body = (t.lines || []).join("\n");
        return `${label}：${body}`;
      })
      .join("\n\n");
  }

  async function copyTextList(payload) {
    if (!payload) {
      showTransientFooterMessage("コピーできるテキストがありません。", 3000);
      return;
    }
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = payload;
      document.body.appendChild(textarea);
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        ok = false;
      }
      textarea.remove();
      return ok;
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(payload);
        showTransientFooterMessage("テキスト一覧をコピーしました。", 3000);
        return;
      }
      const success = fallbackCopy();
      if (success) {
        showTransientFooterMessage("テキスト一覧をコピーしました。", 3000);
      } else {
        throw new Error("copy failed");
      }
    } catch {
      const success = fallbackCopy();
      if (success) {
        showTransientFooterMessage("テキスト一覧をコピーしました。", 3000);
      } else {
        window.alert("クリップボードへのコピーに失敗しました。");
      }
    }
  }

  function refreshTextList() {
    if (textListOpen) {
      renderTextList();
    }
  }

  function sortImagesForList() {
    return images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => !img.tagType)
      .sort((a, b) => {
        const ao = typeof a.img.imageListOrder === "number" ? a.img.imageListOrder : a.img.order ?? a.index;
        const bo = typeof b.img.imageListOrder === "number" ? b.img.imageListOrder : b.img.order ?? b.index;
        return ao - bo;
      });
  }

  function openImageList() {
    imageListOpen = true;
    imageListPanel.classList.remove("hidden");
    positionImageListPanel();
    renderImageList();
  }

  function closeImageList() {
    imageListOpen = false;
    imageListPanel.classList.add("hidden");
    imageListPanel.style.maxHeight = "";
    if (imageListBody) imageListBody.style.maxHeight = "";
    imageListPanel.style.top = "";
    imageListPanel.style.bottom = "";
  }

  function refreshImageList() {
    if (imageListOpen) {
      renderImageList();
    }
  }

  function renderImageList() {
    if (!imageListOpen || !imageListBody) return;
    imageListBody.innerHTML = "";
    sortImagesForList().forEach(({ img, index }, listIndex) => {
      const item = document.createElement("div");
      item.className = "image-list-item";
      item.draggable = true;
      item.dataset.id = img.id;

      const meta = document.createElement("span");
      meta.className = "text-list-meta image-list-number";
      meta.textContent = `#${listIndex + 1}`;

      const thumb = document.createElement("img");
      thumb.className = "image-list-thumb";
      thumb.src = img.src;
      thumb.alt = "";

      const name = document.createElement("button");
      name.type = "button";
      name.className = "image-list-name";
      name.textContent = img.imageName || "(画像名なし)";
      name.title = img.imageName || "";
      name.addEventListener("click", (e) => {
        e.stopPropagation();
        focusImageFromList(img.id);
      });
      name.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const next = window.prompt("画像名を入力", img.imageName || "");
        if (next === null) return;
        const imageName = next.trim();
        img.imageName = imageName;
        emitItemPatch("image", img, { imageName });
        refreshImageList();
      });

      item.appendChild(meta);
      item.appendChild(thumb);
      item.appendChild(name);

      item.addEventListener("click", () => {
        focusImageFromList(img.id);
      });

      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", img.id);
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        item.classList.add("drag-over");
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");
        const sourceId = e.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === img.id) return;
        reorderImageList(sourceId, img.id);
      });

      imageListBody.appendChild(item);
    });
    positionImageListPanel();
  }

  function focusImageFromList(imageId) {
    const targetIdx = findIndexById(images, imageId);
    if (targetIdx < 0) return;
    const target = images[targetIdx];
    offsetX = canvas.width / 2 - (target.x + target.width / 2) * scale;
    offsetY = canvas.height / 2 - (target.y + target.height / 2) * scale;
    selected = { type: "image", index: targetIdx };
    currentTool = "select";
    updateToolButtons();
    redraw();
  }

  function reorderImageList(sourceId, targetId) {
    const ordered = sortImagesForList().map((entry) => entry.img);
    const from = ordered.findIndex((img) => img.id === sourceId);
    const to = ordered.findIndex((img) => img.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    ordered.forEach((img, idx) => {
      img.imageListOrder = idx + 1;
      emitItemPatch("image", img, { imageListOrder: img.imageListOrder });
    });
    imageListOrderCounter = ordered.length + 1;
    renderImageList();
  }

  function toggleImageListPanelView() {
    if (imageListOpen) {
      closeImageList();
    } else {
      openImageList();
    }
  }

  function toggleTextListPanelView() {
    if (textListOpen) {
      closeTextList();
    } else {
      openTextList();
    }
  }

  function positionTextListPanel() {
    if (!textListPanel || textListPanel.classList.contains("hidden")) return;
    const margin = 12;
    const footerSpace = getFooterSpace() + margin;
    const toolbarBottom = toolbarEl
      ? toolbarEl.getBoundingClientRect().bottom + margin
      : 60;
    const top = Math.max(margin, toolbarBottom);
    textListPanel.style.top = `${top}px`;
    textListPanel.style.bottom = "auto";

    const available = window.innerHeight - top - footerSpace - margin;
    const maxH = Math.max(260, available);
    textListPanel.style.maxHeight = `${maxH}px`;
    if (textListBody) {
      const header = textListPanel.querySelector(".text-list-header");
      const headerH = header ? header.getBoundingClientRect().height : 44;
      const bodyMax = Math.max(180, maxH - headerH);
      textListBody.style.maxHeight = `${bodyMax}px`;
    }
  }

  function positionImageListPanel() {
    if (!imageListPanel || imageListPanel.classList.contains("hidden")) return;
    const margin = 12;
    const footerSpace = getFooterSpace() + margin;
    const toolbarBottom = toolbarEl
      ? toolbarEl.getBoundingClientRect().bottom + margin
      : 60;
    const top = Math.max(margin, toolbarBottom);
    imageListPanel.style.top = `${top}px`;
    imageListPanel.style.bottom = "auto";

    const available = window.innerHeight - top - footerSpace - margin;
    const maxH = Math.max(260, available);
    imageListPanel.style.maxHeight = `${maxH}px`;
    if (imageListBody) {
      const header = imageListPanel.querySelector(".text-list-header");
      const headerH = header ? header.getBoundingClientRect().height : 44;
      const bodyMax = Math.max(180, maxH - headerH);
      imageListBody.style.maxHeight = `${bodyMax}px`;
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
    renderInsertMenu();
  }

  function updateBoardTitleDisplay() {
    boardTitleLabel.textContent = `${boardTitle}`;
    document.title = `${boardTitle}`;
  }

  async function loadBoardUsersFromServer() {
    try {
      const res = await fetch(`/api/boards/${boardId}/users`);
      if (!res.ok) throw new Error("failed");
      const list = await res.json();
      if (Array.isArray(list)) {
        boardUsersFromServer = list.filter((x) => typeof x === "string");
        refreshUserDatalist();
      }
    } catch (err) {
      console.warn("Failed to load board users", err);
    }
  }

  async function linkUserToBoardServer(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/boards/${boardId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        if (!boardUsersFromServer.includes(trimmed)) {
          boardUsersFromServer.push(trimmed);
          refreshUserDatalist();
        }
      }
    } catch (err) {
      console.warn("Failed to link user to board", err);
    }
  }

  function setCurrentUser(name) {
    currentUser = name;
    if (name) {
      saveLastUser(name);
      registerUser(name);
      currentTool = "pen";
      if (isAdminUser(name)) {
        activeLayer = "user";
      } else if (activeLayer === "admin") {
        activeLayer = "user";
      }
      const fav = getProfileFavoriteColor(name);
      if (fav) {
        favoritesByUser[name] = fav;
        saveFavorites();
      }
      linkUserToBoardServer(name);
      updateToolButtons();
    }
    updateFavButtons();
    updateLayerToggleUI();
    identifyToServer();
  }

  function requireUser() {
    if (currentUser) return true;
    openUserModal();
    return false;
  }

  function isAdminUser(name = currentUser) {
    return name === "Admin";
  }

  // --- 選択削除/複製 ---
  function deleteSelectedImage() {
    if (!selected || selected.type !== "image") return;
    const removed = images.splice(selected.index, 1)[0];
    if (removed && socketConnected) {
      socket.emit("item:remove", { boardId, type: "image", id: removed.id });
    }
    refreshImageList();
    selected = null;
    redraw();
  }

  function deleteSelection() {
    ensureSnapshotForAction();
    const allowUserLayer =
      activeLayer === "user" || activeLayer === "admin" || activeLayer === "base" || activeLayer === "draft";
    const allowImages =
      activeLayer === "image" ||
      activeLayer === "admin" ||
      (activeLayer === "user" && !!currentUser);
    const strokeIds = [];
    const textIds = [];
    const imageIds = [];
    const draftIds = [];

    const collect = (item) => {
      if (!allowUserLayer && item.type !== "image") return;
      if (!allowImages && item.type === "image") return;
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (st && canDeleteStroke(st) && isStrokeVisible(st)) strokeIds.push(st.id);
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          const st = strokes[idx];
          if (st && canDeleteStroke(st) && isStrokeVisible(st)) strokeIds.push(st.id);
        });
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t && canDeleteText(t) && isTextVisible(t)) textIds.push(t.id);
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img && allowImages && canInteractImage(img)) imageIds.push(img.id);
      } else if (item.type === "draft") {
        const d = draftStrokes[item.index];
        if (d && canDeleteDraft(d) && d.user === currentUser) draftIds.push(d.id);
      } else if (item.type === "draft-group") {
        item.indices.forEach((idx) => {
          const d = draftStrokes[idx];
          if (d && canDeleteDraft(d) && d.user === currentUser) draftIds.push(d.id);
        });
      }
    };

    if (multiSelection && multiSelection.items) {
      multiSelection.items.forEach(collect);
    } else if (selected) {
      collect(selected);
    }

    if (!strokeIds.length && !textIds.length && !imageIds.length && !draftIds.length) return;

    strokeIds.forEach((id) => {
      const idx = findIndexById(strokes, id);
      if (idx >= 0 && canDeleteStroke(strokes[idx])) {
        strokes.splice(idx, 1);
        if (socketConnected) {
          socket.emit("item:remove", { boardId, type: "stroke", id });
        }
      }
    });

    textIds.forEach((id) => {
      const idx = findIndexById(texts, id);
      if (idx >= 0 && canDeleteText(texts[idx])) {
        texts.splice(idx, 1);
        if (socketConnected) {
          socket.emit("item:remove", { boardId, type: "text", id });
        }
      }
    });

    imageIds.forEach((id) => {
      const idx = findIndexById(images, id);
      if (idx >= 0) {
        const removed = images.splice(idx, 1)[0];
        if (removed && socketConnected) {
          socket.emit("item:remove", { boardId, type: "image", id });
        }
      }
    });

    draftIds.forEach((id) => {
      const idx = findIndexById(draftStrokes, id);
      if (idx >= 0 && canDeleteDraft(draftStrokes[idx])) {
        draftStrokes.splice(idx, 1);
        if (socketConnected) {
          socket.emit("draft:stroke:remove", { boardId, id });
        }
      }
    });

    if (textIds.length) refreshTextList();
    if (imageIds.length) refreshImageList();
    selected = null;
    multiSelection = null;
    redraw();
  }

  function getSelectionWorldBounds(items) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const addBounds = (bounds) => {
      if (!bounds) return;
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    };

    items.forEach((item) => {
      if (item.type === "stroke") {
        addBounds(getStrokeBoundsWorld(strokes[item.index]));
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => addBounds(getStrokeBoundsWorld(strokes[idx])));
      } else if (item.type === "draft") {
        addBounds(getStrokeBoundsWorld(draftStrokes[item.index]));
      } else if (item.type === "draft-group") {
        item.indices.forEach((idx) => addBounds(getStrokeBoundsWorld(draftStrokes[idx])));
      } else if (item.type === "text") {
        addBounds(getTextBoundsWorld(texts[item.index]));
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img) addBounds({ x: img.x, y: img.y, width: img.width, height: img.height });
      }
    });

    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function emitItemPatch(type, item, patch) {
    if (!socketConnected || !item) return;
    socket.emit("item:update", {
      boardId,
      type,
      id: item.id,
      patch,
    });
  }

  function rotateSelection(direction) {
    const items = getSelectionItems();
    if (!items.length) return false;
    const bounds = getSelectionWorldBounds(items);
    if (!bounds) return false;
    const center = getRectCenter(bounds);
    const rotatedStrokeIds = new Set();

    ensureSnapshotForAction();
    items.forEach((item) => {
      if (item.type === "stroke") {
        const stroke = strokes[item.index];
        if (!stroke || rotatedStrokeIds.has(stroke.id)) return;
        stroke.points = stroke.points.map((p) => rotatePointAround(p, center, direction));
        rotatedStrokeIds.add(stroke.id);
        emitItemPatch("stroke", stroke, { points: stroke.points.map((p) => ({ x: p.x, y: p.y })) });
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          const stroke = strokes[idx];
          if (!stroke || rotatedStrokeIds.has(stroke.id)) return;
          stroke.points = stroke.points.map((p) => rotatePointAround(p, center, direction));
          rotatedStrokeIds.add(stroke.id);
          emitItemPatch("stroke", stroke, { points: stroke.points.map((p) => ({ x: p.x, y: p.y })) });
        });
      } else if (item.type === "draft") {
        const stroke = draftStrokes[item.index];
        if (!stroke) return;
        stroke.points = stroke.points.map((p) => rotatePointAround(p, center, direction));
        if (socketConnected) {
          socket.emit("draft:stroke:add", { boardId, stroke });
        }
      } else if (item.type === "draft-group") {
        item.indices.forEach((idx) => {
          const stroke = draftStrokes[idx];
          if (!stroke) return;
          stroke.points = stroke.points.map((p) => rotatePointAround(p, center, direction));
          if (socketConnected) {
            socket.emit("draft:stroke:add", { boardId, stroke });
          }
        });
      } else if (item.type === "text") {
        const text = texts[item.index];
        if (!text) return;
        const textBounds = getTextBoundsWorld(text);
        const oldCenter = getRectCenter(textBounds);
        const newCenter = rotatePointAround(oldCenter, center, direction);
        text.x += newCenter.x - oldCenter.x;
        text.y += newCenter.y - oldCenter.y;
        text.rotation = normalizeRotation((text.rotation || 0) + (direction === "cw" ? 90 : -90));
        emitItemPatch("text", text, { x: text.x, y: text.y, rotation: text.rotation });
      } else if (item.type === "image") {
        const img = images[item.index];
        if (!img) return;
        const oldCenter = getRectCenter({ x: img.x, y: img.y, width: img.width, height: img.height });
        const newCenter = rotatePointAround(oldCenter, center, direction);
        img.x += newCenter.x - oldCenter.x;
        img.y += newCenter.y - oldCenter.y;
        img.rotation = normalizeRotation((img.rotation || 0) + (direction === "cw" ? 90 : -90));
        emitItemPatch("image", img, { x: img.x, y: img.y, rotation: img.rotation });
      }
    });
    refreshTextList();
    redraw();
    return true;
  }

  function collectOrderableSelectionItems() {
    const items = [];
    const pushItem = (it) => {
      if (!it) return;
      if (it.type === "stroke-group") {
        it.indices.forEach((idx) => items.push({ type: "stroke", index: idx }));
      } else if (it.type === "stroke" || it.type === "text" || it.type === "image") {
        items.push(it);
      }
    };
    if (multiSelection && multiSelection.items) {
      multiSelection.items.forEach(pushItem);
    } else if (selected) {
      pushItem(selected);
    }
    return items;
  }

  function getItemLayer(it) {
    if (!it) return null;
    if (it.type === "stroke") return (strokes[it.index]?.layer) || "user";
    if (it.type === "text") return (texts[it.index]?.layer) || "user";
    if (it.type === "image") return (images[it.index]?.layer) || "user";
    return null;
  }

  function getItemOrder(it) {
    if (!it) return 0;
    if (it.type === "stroke") return strokes[it.index]?.order ?? 0;
    if (it.type === "text") return texts[it.index]?.order ?? 0;
    if (it.type === "image") return images[it.index]?.order ?? 0;
    return 0;
  }

  function setItemOrder(it, newOrder) {
    if (!it || typeof newOrder !== "number") return;
    if (it.type === "stroke") {
      const s = strokes[it.index];
      if (!s) return;
      s.order = newOrder;
      bumpOrderCounter(newOrder);
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "stroke",
          id: s.id,
          patch: { order: newOrder },
        });
      }
    } else if (it.type === "text") {
      const t = texts[it.index];
      if (!t) return;
      t.order = newOrder;
      bumpOrderCounter(newOrder);
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: t.id,
          patch: { order: newOrder },
        });
      }
    } else if (it.type === "image") {
      const img = images[it.index];
      if (!img) return;
      img.order = newOrder;
      bumpOrderCounter(newOrder);
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "image",
          id: img.id,
          patch: { order: newOrder },
        });
      }
    }
  }

  function getLayerItemsForOrdering(layer) {
    const all = [];
    strokes.forEach((s, idx) => {
      if (!s) return;
      const l = s.layer || "user";
      if (l !== layer) return;
      all.push({ type: "stroke", index: idx, order: s.order ?? 0 });
    });
    texts.forEach((t, idx) => {
      if (!t) return;
      const l = t.layer || "user";
      if (l !== layer) return;
      all.push({ type: "text", index: idx, order: t.order ?? 0 });
    });
    images.forEach((img, idx) => {
      if (!img) return;
      const l = img.layer || "user";
      if (l !== layer) return;
      all.push({ type: "image", index: idx, order: img.order ?? 0 });
    });
    return all;
  }

  function moveSelectionOrder(direction = "front") {
    const targets = collectOrderableSelectionItems();
    if (!targets.length) return;

    const byLayer = new Map();
    targets.forEach((it) => {
      const layer = getItemLayer(it);
      if (!layer) return;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer).push(it);
    });

    byLayer.forEach((items, layer) => {
      const layerItems = getLayerItemsForOrdering(layer);
      if (!layerItems.length) return;
      const orderedTargets = items
        .map((it) => ({ ...it, order: getItemOrder(it) }))
        .sort((a, b) => a.order - b.order);

      const orders = layerItems.map((x) => x.order ?? 0);
      const maxOrder = Math.max(...orders);
      const minOrder = Math.min(...orders);

      if (direction === "front") {
        orderedTargets.forEach((it, idx) => {
          setItemOrder(it, maxOrder + idx + 1);
        });
      } else if (direction === "back") {
        orderedTargets.forEach((it, idx) => {
          setItemOrder(it, minOrder - (idx + 1));
        });
      }
    });
    redraw();
  }

  function duplicateSelectedImages() {
    const items = [];
    if (multiSelection && multiSelection.items) {
      items.push(...multiSelection.items);
    } else if (selected) {
      items.push(selected);
    }
    if (!items.length) return;

    const offset = 18;
    const allowImages =
      activeLayer === "image" ||
      activeLayer === "admin" ||
      (activeLayer === "user" && !!currentUser);

    const isLayerMatch = (layer) => {
      const normalized = layer || "user";
      if (activeLayer === "draft") return normalized === "draft";
      if (activeLayer === "base") return normalized === "base";
      if (activeLayer === "user") return normalized === "user";
      if (activeLayer === "admin") return normalized === "admin";
      return false;
    };
    const clonedStrokeIds = new Set();
    const clonedGroupIds = new Map();
    const getCloneGroupId = (groupId) => {
      if (!groupId) return null;
      if (!clonedGroupIds.has(groupId)) clonedGroupIds.set(groupId, genId());
      return clonedGroupIds.get(groupId);
    };
    const cloneStroke = (s, idxOffset = 1) => {
      if (!s || clonedStrokeIds.has(s.id)) return;
      if (!isLayerMatch(s.layer)) return;
      if (s.layer === "draft" && s.user !== currentUser) return;
      const clone = {
        ...s,
        id: genId(),
        groupId: getCloneGroupId(s.groupId),
        points: s.points.map((p) => ({ x: p.x + offset * idxOffset, y: p.y + offset * idxOffset })),
        order: orderCounter++,
        user: currentUser,
      };
      strokes.push(clone);
      clonedStrokeIds.add(s.id);
      if (socketConnected) {
        socket.emit("stroke:add", { boardId, stroke: clone });
      }
    };

    items.forEach((item, idx) => {
      if (item.type === "image" && allowImages) {
        const imgObj = images[item.index];
        if (!imgObj) return;
        if (!canInteractImage(imgObj)) return;
        const clone = {
          ...imgObj,
          id: genId(),
          x: imgObj.x + offset * (idx + 1) * 0.5,
          y: imgObj.y + offset * (idx + 1) * 0.5,
          order: orderCounter++,
          imageListOrder: bumpImageListOrderCounter(),
          user: currentUser,
        };
        images.push(clone);
        refreshImageList();
        emitImageAdd(clone);
      } else if (item.type === "stroke" && activeLayer !== "image") {
        cloneStroke(strokes[item.index], idx + 1);
      } else if (item.type === "stroke-group" && activeLayer !== "image") {
        item.indices.forEach((strokeIndex) => cloneStroke(strokes[strokeIndex], idx + 1));
      } else if (item.type === "text" && activeLayer !== "image") {
        const t = texts[item.index];
        if (!t) return;
        if (!isLayerMatch(t.layer)) return;
        if (t.layer === "draft" && t.user !== currentUser) return;
        const clone = {
          ...t,
          id: genId(),
          x: t.x + offset,
          y: t.y + offset,
          order: orderCounter++,
          user: currentUser,
        };
        texts.push(clone);
        refreshTextList();
        if (socketConnected) {
          socket.emit("text:add", { boardId, text: clone });
        }
      }
    });
    redraw();
  }

  function fillClosedStrokeAt(worldPoint) {
    if (!requireUser()) return false;
    if (activeLayer === "image") {
      showTransientFooterMessage("塗りつぶしは通常/Admin/ベースレイヤーで使えます。", 3000);
      return false;
    }

    let target = null;
    const sourceList = activeLayer === "draft" ? draftStrokes : strokes;
    for (let i = sourceList.length - 1; i >= 0; i--) {
      const stroke = sourceList[i];
      if (!stroke || stroke.fill) continue;
      if (activeLayer === "draft") {
        if (stroke.user !== currentUser) continue;
      } else {
        if (!isStrokeVisible(stroke)) continue;
        if (!canInteractStroke(stroke)) continue;
      }
      const bounds = getStrokeBoundsWorld(stroke);
      if (!bounds || !pointInRectWorld(bounds, worldPoint)) continue;
      if (!pointInPolygon(worldPoint, stroke.points)) continue;
      const area = polygonArea(stroke.points);
      if (area <= 1) continue;
      if (!target || area < target.area) {
        target = { stroke, area };
      }
    }

    if (!target) {
      showTransientFooterMessage("閉じた線の内側をクリックしてください。", 3000);
      return false;
    }

    ensureSnapshotForAction();
    const source = target.stroke;
    const existingFill = sourceList.some((stroke) => {
      if (!stroke?.fill) return false;
      if (source.groupId && stroke.groupId === source.groupId) return true;
      return stroke.fillSourceId === source.id;
    });
    if (existingFill) {
      showTransientFooterMessage("このオブジェクトはすでに塗りつぶされています。", 3000);
      return false;
    }
    const groupId = source.groupId || genId();
    if (!source.groupId) {
      source.groupId = groupId;
      if (activeLayer === "draft") {
        if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: source });
      } else {
        emitItemPatch("stroke", source, { groupId });
      }
    }
    const fillStroke = {
      id: genId(),
      color: withAlpha(currentColor, 0.38),
      size: 1,
      points: source.points.map((p) => ({ x: p.x, y: p.y })),
      user: currentUser,
      layer: activeLayer === "draft" ? "draft" : getShapeTargetLayer(),
      order: activeLayer === "draft" ? (source.order ?? draftOrderCounter++) - 0.1 : (source.order ?? orderCounter++) - 0.1,
      createdAt: Date.now(),
      fill: true,
      groupId,
      fillSourceId: source.id,
    };
    if (activeLayer === "draft") {
      draftStrokes.push(fillStroke);
    } else {
      strokes.push(fillStroke);
    }
    registerUser(currentUser);
    if (socketConnected) {
      if (activeLayer === "draft") {
        socket.emit("draft:stroke:add", { boardId, stroke: fillStroke });
      } else {
        socket.emit("stroke:add", { boardId, stroke: fillStroke });
      }
    }
    redraw();
    return true;
  }

  function copySelectionToDraft() {
    if (!requireUser()) return;
    const items = getSelectionItems();
    if (!items.length) return;
    ensureSnapshotForAction();

    const copiedStrokeIds = new Set();
    const copiedGroupIds = new Map();
    const offset = 18 / scale;
    const getDraftGroupId = (groupId) => {
      if (!groupId) return null;
      if (!copiedGroupIds.has(groupId)) copiedGroupIds.set(groupId, genId());
      return copiedGroupIds.get(groupId);
    };
    const copyStrokeToDraft = (s) => {
      if (!s || copiedStrokeIds.has(s.id)) return false;
      const draftGroupId = getDraftGroupId(s.groupId);
      const draft = {
        id: genId(),
        color: s.fill ? s.color : withAlpha(s.color || currentColor, 0.55),
        size: s.size || currentSize,
        points: (s.points || []).map((p) => ({ x: p.x + offset, y: p.y + offset })),
        user: currentUser,
        order: draftOrderCounter++,
        createdAt: Date.now(),
        fill: !!s.fill,
        groupId: draftGroupId,
      };
      draftStrokes.push(draft);
      copiedStrokeIds.add(s.id);
      if (socketConnected) {
        socket.emit("draft:stroke:add", { boardId, stroke: draft });
      }
      return true;
    };
    let copied = false;
    items.forEach((item) => {
      if (item.type === "stroke") {
        copied = copyStrokeToDraft(strokes[item.index]) || copied;
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          copied = copyStrokeToDraft(strokes[idx]) || copied;
        });
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (!t) return;
        const clone = {
          ...t,
          id: genId(),
          lines: t.lines ? [...t.lines] : [],
          x: t.x + offset,
          y: t.y + offset,
          layer: "draft",
          user: currentUser,
          order: orderCounter++,
          createdAt: Date.now(),
        };
        texts.push(clone);
        copied = true;
        refreshTextList();
        if (socketConnected) {
          socket.emit("text:add", { boardId, text: clone });
        }
      }
    });

    if (copied) {
      showTransientFooterMessage("選択内容を下書きレイヤーにコピーしました。", 3000);
      redraw();
    }
  }

  function applyDraftSelectionToPublic() {
    if (activeLayer !== "draft") return;
    if (activeLayer === "image") return;
    const targets = getSelectionItems()
      .flatMap((it) => {
        if (it.type === "draft") return [it.index];
        if (it.type === "draft-group") return it.indices;
        return [];
      });
    const unique = Array.from(new Set(targets))
      .map((idx) => draftStrokes[idx])
      .filter(Boolean);
    if (!unique.length) return;

    const targetLayer = "user";

    unique.forEach((draft) => {
      const stroke = {
        id: genId(),
        color: draft.color,
        size: draft.size,
        points: draft.points.map((p) => ({ x: p.x, y: p.y })),
        user: currentUser,
        layer: targetLayer,
        order: orderCounter++,
        fill: !!draft.fill,
        groupId: draft.groupId || null,
      };
      strokes.push(stroke);
      registerUser(currentUser);
      if (socketConnected) {
        socket.emit("stroke:add", { boardId, stroke });
      }
    });

    unique.forEach((draft) => {
      const idx = findIndexById(draftStrokes, draft.id);
      if (idx >= 0) draftStrokes.splice(idx, 1);
      if (socketConnected) {
        socket.emit("draft:stroke:remove", { boardId, id: draft.id });
      }
    });

    multiSelection = null;
    redraw();
  }

  function moveSelectionToBase() {
    if (!isAdminUser()) {
      showTransientFooterMessage("ベースレイヤーへの移動は Admin のみ可能です。", 4000);
      return;
    }
    const items = [];
    if (multiSelection && multiSelection.items) {
      items.push(...multiSelection.items);
    } else if (selected) {
      items.push(selected);
    }
    if (!items.length) return;

    items.forEach((item) => {
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (st && st.layer !== "base") {
          st.layer = "base";
          if (socketConnected) {
            socket.emit("item:update", {
              boardId,
              type: "stroke",
              id: st.id,
              patch: { layer: "base" },
            });
          }
        }
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          const st = strokes[idx];
          if (st && st.layer !== "base") {
            st.layer = "base";
            if (socketConnected) {
              socket.emit("item:update", {
                boardId,
                type: "stroke",
                id: st.id,
                patch: { layer: "base" },
              });
            }
          }
        });
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t && t.layer !== "base") {
          t.layer = "base";
          if (socketConnected) {
            socket.emit("item:update", {
              boardId,
              type: "text",
              id: t.id,
              patch: { layer: "base" },
            });
          }
        }
      }
    });
    redraw();
  }

  function moveSelectionToImage() {
    if (!isAdminUser()) {
      showTransientFooterMessage("画像レイヤーへの移動は Admin のみ可能です。", 4000);
      return;
    }
    const items = [];
    if (multiSelection && multiSelection.items) {
      items.push(...multiSelection.items);
    } else if (selected) {
      items.push(selected);
    }
    if (!items.length) return;

    let changed = false;
    items.forEach((item) => {
      if (item.type === "image") {
        const img = images[item.index];
        if (img && img.layer !== "image") {
          img.layer = "image";
          changed = true;
          if (socketConnected) {
            socket.emit("item:update", {
              boardId,
              type: "image",
              id: img.id,
              patch: { layer: "image" },
            });
          }
        }
      }
    });
    if (changed) {
      redraw();
    }
  }

  function openUserModal() {
    closeTextList();
    loadBoardUsersFromServer();
    refreshUserDatalist();
    if (userNameInput) {
      userNameInput.value = "";
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
    identifyToServer();
  });

  socket.on("disconnect", () => {
    socketConnected = false;
  });

  function identifyToServer() {
    if (!socketConnected || !currentUser) return;
    socket.emit("user:identify", { boardId, user: currentUser });
  }

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
    if ((t.layer || "user") === "base") return activeLayer === "base";
    if (isAdminUser() || activeLayer === "admin") return true;
    return !t.user || t.user === currentUser;
  }

  function canDeleteStroke(stroke) {
    if ((stroke.layer || "user") === "base") return activeLayer === "base";
    if (isAdminUser() || activeLayer === "admin") return true;
    return !stroke.user || stroke.user === currentUser;
  }

  function canDeleteDraft(stroke) {
    return stroke && stroke.user === currentUser;
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
    draftStrokes.length = 0;
    draftOrderCounter = 0;
    draftsLoaded = false;

    if (state?.strokes) {
      state.strokes.forEach((s) => addStrokeFromNetwork(s, false));
    }
    if (state?.texts) {
      state.texts.forEach((t) => addTextFromNetwork(t, false));
    }
    if (state?.images) {
      state.images.forEach((img) => addImageFromNetwork(img, true));
    }
    redraw();
  }

  function addStrokeFromNetwork(stroke, shouldRedraw = true) {
    if (findIndexById(strokes, stroke.id) >= 0) return;
    const withLayer = { ...stroke, layer: stroke.layer || "user" };
    strokes.push(withLayer);
    bumpOrderCounter(stroke.order);
    registerUser(withLayer.user);
    if (shouldRedraw) redraw();
  }

  function addDraftFromNetwork(stroke, shouldRedraw = true) {
    if (findIndexById(draftStrokes, stroke.id) >= 0) return;
    draftStrokes.push(stroke);
    bumpDraftOrderCounter(stroke.order);
    if (shouldRedraw && activeLayer === "draft") redraw();
  }

  function addTextFromNetwork(text, shouldRedraw = true) {
    if (findIndexById(texts, text.id) >= 0) return;
    const withCreated = {
      ...text,
      createdAt: text.createdAt || Date.now(),
      label: text.label || "",
      layer: text.layer || "user",
      rotation: text.rotation || 0,
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
    const finish = () => {
      const imageListOrder =
        typeof imgData.imageListOrder === "number" ? imgData.imageListOrder : bumpImageListOrderCounter();
      images.push({
        ...imgData,
        rotation: imgData.rotation || 0,
        imageName: imgData.imageName || "",
        imageListOrder,
        img,
      });
      bumpImageListOrderCounter(imageListOrder);
      bumpOrderCounter(imgData.order);
      registerUser(imgData.user);
      refreshImageList();
      if (shouldRedraw) redraw();
    };
    img.onload = finish;
    img.onerror = () => {
      console.error("failed to load image", imgData?.id);
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

  socket.on("draft:init", (drafts) => {
    draftStrokes.length = 0;
    draftOrderCounter = 0;
    (drafts || []).forEach((d) => addDraftFromNetwork(d, false));
    draftsLoaded = true;
    redraw();
    updateFooterByState();
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
        refreshImageList();
      }
    refreshTextList();
    redraw();
    updateFooterByState();
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
        const currentImgEl = list[idx].img;
        list[idx] = { ...list[idx], ...patch, img: currentImgEl };
        if (patch.src && patch.src !== currentImgEl?.src) {
          const img = new Image();
          img.onload = () => {
            list[idx].img = img;
            redraw();
          };
          img.src = patch.src;
        }
      } else {
        list[idx] = { ...list[idx], ...patch };
      }
      if (type === "text") {
        refreshTextList();
      } else if (type === "image") {
        refreshImageList();
      }
      redraw();
      updateFooterByState();
    }
  });

  // --- 画像ヒットテスト ---
  function getNormalizedRect(r) {
    const x = Math.min(r.x, r.x + r.width);
    const y = Math.min(r.y, r.y + r.height);
    const w = Math.abs(r.width);
    const h = Math.abs(r.height);
    return { x, y, width: w, height: h };
  }

  function rectsOverlap(a, b) {
    return (
      a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y
    );
  }

  function pointInRectWorld(rect, p) {
    return (
      p.x >= rect.x &&
      p.x <= rect.x + rect.width &&
      p.y >= rect.y &&
      p.y <= rect.y + rect.height
    );
  }

  function isPointNearSegment(px, py, ax, ay, bx, by, tol) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLen2 = abx * abx + aby * aby;
    let t = 0;
    if (abLen2 > 0) {
      t = (apx * abx + apy * aby) / abLen2;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= tol * tol;
  }

  function isPointNearStroke(stroke, worldPoint, tolWorld) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;
    const pts = stroke.points;
    if (pts.length === 1) {
      const dx = worldPoint.x - pts[0].x;
      const dy = worldPoint.y - pts[0].y;
      return dx * dx + dy * dy <= tolWorld * tolWorld;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (isPointNearSegment(worldPoint.x, worldPoint.y, a.x, a.y, b.x, b.y, tolWorld)) {
        return true;
      }
    }
    return false;
  }

  function isClosedStroke(stroke) {
    const pts = stroke?.points || [];
    if (pts.length < 3) return false;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const closeTol = Math.max(12 / scale, (stroke.size || 1) * 2);
    return Math.hypot(first.x - last.x, first.y - last.y) <= closeTol;
  }

  function pointInPolygon(point, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const pi = points[i];
      const pj = points[j];
      const intersects =
        pi.y > point.y !== pj.y > point.y &&
        point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-9) + pi.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function polygonArea(points) {
    if (!points || points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  function getStrokeGroupSelection(strokeIndex) {
    const stroke = strokes[strokeIndex];
    if (!stroke) return null;
    if (!stroke.groupId) return { type: "stroke", index: strokeIndex };
    const indices = [];
    strokes.forEach((st, i) => {
      if (st.groupId === stroke.groupId) indices.push(i);
    });
    return indices.length > 1
      ? { type: "stroke-group", groupId: stroke.groupId, indices }
      : { type: "stroke", index: strokeIndex };
  }

  function getDraftGroupSelection(draftIndex) {
    const stroke = draftStrokes[draftIndex];
    if (!stroke) return null;
    if (!stroke.groupId) return { type: "draft", index: draftIndex };
    const indices = [];
    draftStrokes.forEach((st, i) => {
      if (st.groupId === stroke.groupId && st.user === currentUser) indices.push(i);
    });
    return indices.length > 1
      ? { type: "draft-group", groupId: stroke.groupId, indices }
      : { type: "draft", index: draftIndex };
  }

  function hitTestStroke(screenX, screenY, targetLayerCheck = (s) => true) {
    const worldPoint = screenToWorld(screenX, screenY);
    const tolWorld = 6 / scale;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (!s || !s.points || !targetLayerCheck(s)) continue;
      const bounds = getStrokeBoundsWorld(s);
      if (!bounds) continue;
      if (
        worldPoint.x >= bounds.x &&
        worldPoint.x <= bounds.x + bounds.width &&
        worldPoint.y >= bounds.y &&
        worldPoint.y <= bounds.y + bounds.height
      ) {
        if (s.fill && pointInPolygon(worldPoint, s.points)) return i;
        const tol = Math.max(tolWorld, (s.size || 1) / scale / 2);
        if (isPointNearStroke(s, worldPoint, tol)) return i;
      }
    }
    return -1;
  }

  function hitTestDraftStroke(screenX, screenY) {
    if (activeLayer !== "draft") return -1;
    const worldPoint = screenToWorld(screenX, screenY);
    const tolWorld = 6 / scale;
    for (let i = draftStrokes.length - 1; i >= 0; i--) {
      const s = draftStrokes[i];
      if (!s || !s.points || s.user !== currentUser) continue;
      const bounds = getStrokeBoundsWorld(s);
      if (!bounds) continue;
      if (
        worldPoint.x >= bounds.x &&
        worldPoint.x <= bounds.x + bounds.width &&
        worldPoint.y >= bounds.y &&
        worldPoint.y <= bounds.y + bounds.height
      ) {
        if (s.fill && pointInPolygon(worldPoint, s.points)) return i;
        const tol = Math.max(tolWorld, (s.size || 1) / scale / 2);
        if (isPointNearStroke(s, worldPoint, tol)) return i;
      }
    }
    return -1;
  }

  function getStrokeBoundsWorld(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    stroke.points.forEach((p) => {
      if (typeof p.x === "number" && typeof p.y === "number") {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    });
    if (!Number.isFinite(minX)) return null;
    const padding = (stroke.size || 1) / 2;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  function hitTestImage(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canInteractImage(imgObj)) continue;
      const bounds = { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height };
      if (pointInRotatedRectWorld(worldPoint, bounds, imgObj.rotation || 0)) {
        return i;
      }
    }
    return -1;
  }

  function findImageNameAtScreenPoint(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!imgObj || imgObj.tagType || !imgObj.imageName) continue;
      if (!isImageVisible(imgObj)) continue;
      const bounds = { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height };
      if (pointInRotatedRectWorld(worldPoint, bounds, imgObj.rotation || 0)) {
        return imgObj.imageName;
      }
    }
    return "";
  }

  function hitTestImageResizeHandle(screenX, screenY, radius = 8) {
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canInteractImage(imgObj)) continue;
      const corners = getRotatedRectCornersWorld(
        { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
        imgObj.rotation || 0
      ).map((p) => worldToScreen(p.x, p.y));
      const handles = [
        { id: "tl", ...corners[0] },
        { id: "tr", ...corners[1] },
        { id: "br", ...corners[2] },
        { id: "bl", ...corners[3] },
      ];
      for (const hpos of handles) {
        const dx = screenX - hpos.x;
        const dy = screenY - hpos.y;
        if (dx * dx + dy * dy <= radius * radius) {
          return { index: i, handle: hpos.id };
        }
      }
    }
    return null;
  }

  // --- テキストヒットテスト ---
  function hitTestText(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!isTextVisible(t)) continue;
      if (!canInteractText(t)) continue;
      const b = getTextBoundsWorld(t);
      if (pointInRotatedRectWorld(worldPoint, b, t.rotation || 0)) {
        return i;
      }
    }
    return -1;
  }

  function hitTestTextResizeHandle(screenX, screenY, radius = 8) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!isTextVisible(t)) continue;
      if (!canInteractText(t)) continue;
      const b = getTextBoundsWorld(t);
      const corners = getRotatedRectCornersWorld(b, t.rotation || 0);
      const handle = worldToScreen(corners[2].x, corners[2].y);
      const hx = handle.x;
      const hy = handle.y;
      const dx = screenX - hx;
      const dy = screenY - hy;
      if (dx * dx + dy * dy <= radius * radius) {
        return i;
      }
    }
    return -1;
  }

  // --- 範囲選択 ---
  function applyLassoSelection(rectScreen) {
    const normScreen = getNormalizedRect(rectScreen);
    const startWorld = screenToWorld(normScreen.x, normScreen.y);
    const endWorld = screenToWorld(
      normScreen.x + normScreen.width,
      normScreen.y + normScreen.height
    );
    const rectWorld = getNormalizedRect({
      x: startWorld.x,
      y: startWorld.y,
      width: endWorld.x - startWorld.x,
      height: endWorld.y - startWorld.y,
    });

    const items = [];
    if (activeLayer === "image") {
      images.forEach((img, idx) => {
        const bounds = { x: img.x, y: img.y, width: img.width, height: img.height };
        if (rectsOverlap(bounds, rectWorld)) {
          items.push({ type: "image", index: idx });
        }
      });
      if (isAdminUser()) {
        strokes.forEach((s, idx) => {
          if (!isStrokeVisible(s)) return;
          if (!canInteractStroke(s)) return;
          const bounds = getStrokeBoundsWorld(s);
          if (bounds && rectsOverlap(bounds, rectWorld)) {
            items.push({ type: "stroke", index: idx });
          }
        });
      }
    } else {
      strokes.forEach((s, idx) => {
        if (!isStrokeVisible(s)) return;
        if (!canInteractStroke(s)) return;
        const bounds = getStrokeBoundsWorld(s);
        if (bounds && rectsOverlap(bounds, rectWorld)) {
          if (s.groupId) {
            const exists = items.find((it) => it.type === "stroke-group" && it.groupId === s.groupId);
            if (!exists) {
              const indices = [];
              strokes.forEach((st, i) => st.groupId === s.groupId && indices.push(i));
              items.push({ type: "stroke-group", groupId: s.groupId, indices });
            }
          } else {
            items.push({ type: "stroke", index: idx });
          }
        }
      });
      texts.forEach((t, idx) => {
        if (!isTextVisible(t)) return;
        if (!canInteractText(t)) return;
        const bounds = getTextBoundsWorld(t);
        if (bounds && rectsOverlap(bounds, rectWorld)) {
          items.push({ type: "text", index: idx });
        }
      });
      images.forEach((img, idx) => {
        if (!canInteractImage(img)) return;
        const bounds = { x: img.x, y: img.y, width: img.width, height: img.height };
        if (bounds && rectsOverlap(bounds, rectWorld)) {
          items.push({ type: "image", index: idx });
        }
      });
      if (activeLayer === "draft") {
        draftStrokes.forEach((s, idx) => {
          if (!canDeleteDraft(s)) return;
          if (s.user !== currentUser) return;
          const bounds = getStrokeBoundsWorld(s);
          if (bounds && rectsOverlap(bounds, rectWorld)) {
            items.push({ type: "draft", index: idx });
          }
        });
      }
    }

    if (items.length === 1) {
      const only = items[0];
      if (only.type === "image" || only.type === "text") {
        selected = { type: only.type, index: only.index };
      } else {
        selected = null;
      }
    } else {
      selected = null;
    }

    multiSelection = items.length
      ? { items, rectScreen: normScreen, rectWorld }
      : null;
    redraw();
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
    if (
      activeLayer !== "user" &&
      activeLayer !== "admin" &&
      activeLayer !== "base" &&
      activeLayer !== "draft" &&
      !(activeLayer === "image" && isAdminUser())
    )
      return;
    let erased = false;
    const radiusWorld = 10 / scale;

    // 下書きストローク（下書き/管理者のみ）
    if (activeLayer === "draft" || activeLayer === "admin") {
      for (let i = draftStrokes.length - 1; i >= 0; i--) {
        const s = draftStrokes[i];
        if (!canDeleteDraft(s)) continue;
        const bounds = getStrokeBoundsWorld(s);
        if (!bounds) continue;
        if (
          worldX >= bounds.x &&
          worldX <= bounds.x + bounds.width &&
          worldY >= bounds.y &&
          worldY <= bounds.y + bounds.height
        ) {
          draftStrokes.splice(i, 1);
          if (socketConnected) {
            socket.emit("draft:stroke:remove", { boardId, id: s.id });
          }
          erased = true;
        }
        if (erased) break;
      }
    }

    // テキスト（自分のレイヤーのみ）
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!isTextVisible(t)) continue;
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
      if (!isStrokeVisible(stroke)) continue;
      const pts = stroke.points;
      const bounds = getStrokeBoundsWorld(stroke);
      if (
        bounds &&
        worldX >= bounds.x &&
        worldX <= bounds.x + bounds.width &&
        worldY >= bounds.y &&
        worldY <= bounds.y + bounds.height
      ) {
        if (stroke.fill && !pointInPolygon({ x: worldX, y: worldY }, stroke.points)) continue;
        // グリッドなどグループはまとめて削除
        const targetGroup = stroke.groupId || null;
        for (let j = strokes.length - 1; j >= 0; j--) {
          const st = strokes[j];
          if (!st) continue;
          if (targetGroup) {
            if (st.groupId !== targetGroup) continue;
          } else if (st.id !== stroke.id) {
            continue;
          }
          strokes.splice(j, 1);
          if (socketConnected) {
            socket.emit("item:remove", { boardId, type: "stroke", id: st.id });
          }
        }
        erased = true;
        break;
      }
    }

    if (erased) {
      redraw();
    }
  }

  // --- 描画処理 ---
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. すべての描画オブジェクトを統合して並び替え
    const combined = [];
    strokes.forEach((s, idx) =>
      combined.push({
        type: "stroke",
        order: s.order ?? idx,
        index: idx,
        layer: s.layer || "user",
      })
    );
    draftStrokes.forEach((s, idx) =>
      combined.push({
        type: "draft-stroke",
        order: s.order ?? draftStrokes.length + idx,
        index: idx,
        layer: "draft",
      })
    );
    images.forEach((img, idx) => {
      if (!isImageVisible(img)) return;
      combined.push({
        type: "image",
        order: img.order ?? orderCounter + idx,
        index: idx,
        layer: img.layer || "base",
      });
    });
    texts.forEach((t, idx) =>
      combined.push({
        type: "text",
        order: t.order ?? strokes.length + idx,
        index: idx,
        layer: t.layer || "user",
      })
    );
    combined.sort((a, b) => {
      const layerPriority = (item) => {
        const layer = item.layer || "user";
        if (layer === "image") return 0; // 最下層
        if (layer === "base") return 1;
        if (layer === "user" || layer === "admin") return 2;
        if (layer === "draft") return 3; // 最上層
        return 4;
      };
      const lpA = layerPriority(a);
      const lpB = layerPriority(b);
      if (lpA !== lpB) return lpA - lpB;
      const ordA = typeof a.order === "number" ? a.order : 0;
      const ordB = typeof b.order === "number" ? b.order : 0;
      return ordA - ordB;
    });

    ctx.textBaseline = "top";
    for (const item of combined) {
      if (item.type === "image") {
        const imgObj = images[item.index];
        const imgEl = imgObj?.img;
        if (!imgObj || !imgEl || !imgEl.complete || imgEl.naturalWidth === 0 || imgEl.naturalHeight === 0) {
          continue;
        }
        const p = worldToScreen(imgObj.x, imgObj.y);
        const w = imgObj.width * scale;
        const h = imgObj.height * scale;
        const rotation = normalizeRotation(imgObj.rotation || 0);
        try {
          if (imgObj.tagType) {
            drawFrameTagImage(ctx, imgObj, p, w, h, rotation);
          } else {
            ctx.save();
            try {
              if (rotation) {
                ctx.translate(p.x + w / 2, p.y + h / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(imgEl, -w / 2, -h / 2, w, h);
              } else {
                ctx.drawImage(imgEl, p.x, p.y, w, h);
              }
            } finally {
              ctx.restore();
            }
          }
        } catch (err) {
          console.error("failed to draw image", imgObj?.id, err);
          continue;
        }
        if (selected && selected.type === "image" && selected.index === item.index) {
          drawSelectionBoundsWorld(
            { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
            rotation
          );
        }
      } else if (item.type === "stroke") {
        const stroke = strokes[item.index];
        if (!stroke || !stroke.points || stroke.points.length === 0) continue;
        if (!isStrokeVisible(stroke)) {
          continue;
        }
        if (stroke.fill) {
          if (stroke.points.length < 3) continue;
          ctx.save();
          ctx.fillStyle = stroke.color || withAlpha(currentColor, 0.38);
          ctx.beginPath();
          const first = worldToScreen(stroke.points[0].x, stroke.points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < stroke.points.length; i++) {
            const p = worldToScreen(stroke.points[i].x, stroke.points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          continue;
        }
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
      } else if (item.type === "draft-stroke") {
        const stroke = draftStrokes[item.index];
        if (!stroke || !stroke.points || stroke.points.length === 0) continue;
        if (activeLayer !== "draft") continue;
        if (stroke.user !== currentUser) continue;
        if (stroke.fill) {
          if (stroke.points.length < 3) continue;
          ctx.save();
          ctx.fillStyle = stroke.color || withAlpha(currentColor, 0.38);
          ctx.beginPath();
          const first = worldToScreen(stroke.points[0].x, stroke.points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < stroke.points.length; i++) {
            const p = worldToScreen(stroke.points[i].x, stroke.points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.save();
        const glowColor = getCurrentFavoriteColor();
        const baseStrokeColor = stroke.color || withAlpha(currentColor, 0.55);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = baseStrokeColor;
        ctx.lineWidth = stroke.size * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
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
        if (!isTextVisible(t)) {
          if (activeLayer !== "draft") continue;
        }
        const base = worldToScreen(t.x, t.y);
        const bounds = getTextBoundsWorld(t);
        const center = worldToScreen(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        const rotation = normalizeRotation(t.rotation || 0);
        const fontSizePx = (t.fontSize || 16) * scale;
        const lineHeight = fontSizePx * 1.2;
        const baseColor = normalizeHexColor(t.color || "#000000");
        const fillColor = lightenColor(baseColor);
        const { outer: strokeWidth } = getTextStrokeWidths(fontSizePx);

        ctx.save();
        if (rotation) {
          ctx.translate(center.x, center.y);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-center.x, -center.y);
        }
        ctx.font = `${fontSizePx}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2.5;

        t.lines.forEach((line, idx) => {
          const y = base.y + idx * lineHeight;

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(line, base.x, y);

          ctx.fillStyle = fillColor;
          ctx.fillText(line, base.x, y);
        });
        ctx.restore();

        if (selected && selected.type === "text" && selected.index === item.index) {
          drawSelectionBoundsWorld(bounds, rotation);
        }
      }
    }

    // 4. 図形プレビュー
    if (isDrawingShape && shapeMode && shapeStart && shapePreview) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#0078d7";
      ctx.lineWidth = 2;
      const start = worldToScreen(shapeStart.x, shapeStart.y);
      const end = worldToScreen(shapePreview.x, shapePreview.y);
      if (shapeMode === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (shapeMode === "rect") {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        ctx.strokeRect(x, y, w, h);
      } else if (shapeMode === "grid") {
        const bounds = getSquareBoundsFromDrag(shapeStart, shapePreview);
        const topLeft = worldToScreen(bounds.x0, bounds.y0);
        const bottomRight = worldToScreen(bounds.x1, bounds.y1);
        const x = topLeft.x;
        const y = topLeft.y;
        const w = bottomRight.x - topLeft.x;
        const h = bottomRight.y - topLeft.y;
        const n = Math.max(2, shapeGridRows || shapeGridCols || 2);
        ctx.strokeRect(x, y, w, h);
        if (bounds.side > 0) {
          for (let i = 1; i < n; i++) {
            const lineX = x + (w * i) / n;
            const lineY = y + (h * i) / n;
            ctx.beginPath();
            ctx.moveTo(lineX, y);
            ctx.lineTo(lineX, y + h);
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + w, lineY);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    if (isPlacingFrame && framePlaceStart && framePlacePreview) {
      const start = worldToScreen(framePlaceStart.x, framePlaceStart.y);
      const end = worldToScreen(framePlacePreview.x, framePlacePreview.y);
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    if (multiSelection && multiSelection.rectWorld) {
      const r = multiSelection.rectWorld;
      const tl = worldToScreen(r.x, r.y);
      const br = worldToScreen(r.x + r.width, r.y + r.height);
      drawLassoRectScreen(
        {
          x: tl.x,
          y: tl.y,
          width: br.x - tl.x,
          height: br.y - tl.y,
        },
        "#ff9800"
      );
    }
    if (isSelectingArea && selectionDragStart && selectionDragCurrent) {
      drawLassoRectScreen(
        {
          x: selectionDragStart.x,
          y: selectionDragStart.y,
          width: selectionDragCurrent.x - selectionDragStart.x,
          height: selectionDragCurrent.y - selectionDragStart.y,
        },
        "#0078d7"
      );
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
    const handles = [
      { x: x, y: y }, // tl
      { x: x + w, y: y }, // tr
      { x: x, y: y + h }, // bl
      { x: x + w, y: y + h }, // br
    ];
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0078d7";
    handles.forEach((h) => {
      ctx.beginPath();
      ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSelectionBoundsWorld(bounds, rotation = 0) {
    const normalizedRotation = normalizeRotation(rotation);
    if (!normalizedRotation) {
      const p = worldToScreen(bounds.x, bounds.y);
      drawSelectionRect(p.x, p.y, bounds.width * scale, bounds.height * scale);
      return;
    }

    const corners = getRotatedRectCornersWorld(bounds, normalizedRotation).map((p) =>
      worldToScreen(p.x, p.y)
    );
    ctx.save();
    ctx.strokeStyle = "#0078d7";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const handleSize = 8;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0078d7";
    corners.forEach((corner) => {
      ctx.beginPath();
      ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawLassoRectScreen(rect, color = "#0078d7") {
    if (!rect) return;
    const norm = getNormalizedRect(rect);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(norm.x, norm.y, norm.width, norm.height);
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
    const footerSpace = getFooterSpace();
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
    const h = rect.height - footerSpace;

    const t = typeof performance !== "undefined" ? performance.now() : Date.now();

    attentionPointers.forEach((p) => {
      const screen = worldToScreen(p.x, p.y);
      const color = p.color || "#ff3b30";
      const visible =
        screen.x >= 0 && screen.x <= w && screen.y >= 0 && screen.y <= h;

      if (visible) {
        drawLaser(screen.x, screen.y, color);
      } else {
        drawAttentionArrow(screen.x, screen.y, color, w, h, t, footerSpace);
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

  function drawAttentionArrow(x, y, color, w, h, t, bottomPad = 0) {
    ctx.save();
    const padding = 12;
    const baseSize = 44;
    const pulse = 1 + 0.45 * Math.sin(t / 140);
    const nudge = 10 * Math.sin(t / 200);
    const size = baseSize * pulse;
    let drawX = Math.min(Math.max(x, padding), w - padding);
    let drawY = Math.min(Math.max(y, padding), h - padding - bottomPad);

    const dirX = x < 0 ? -1 : x > w ? 1 : 0;
    const dirY = y < 0 ? -1 : y > h ? 1 : 0;

    // 辺に張り付け
    if (dirX === -1) drawX = padding;
    if (dirX === 1) drawX = w - padding;
    if (dirY === -1) drawY = padding;
    if (dirY === 1) drawY = h - padding - bottomPad;

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

  function getFooterSpace() {
    if (!footerHint) return 0;
    const rect = footerHint.getBoundingClientRect();
    return rect.height; // 余白ぶんを控えめに
  }

  // --- 画像追加 ---
  function getImageTargetLayer() {
    if (activeLayer === "image") return "image";
    if (activeLayer === "base") return "base";
    if (activeLayer === "admin" && isAdminUser()) return "admin";
    return "user";
  }

  function addImageFile(file, worldX, worldY, layout = null, targetLayer = getImageTargetLayer()) {
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

        let placeX = worldX - w / 2;
        let placeY = worldY - h / 2;
        if (layout) {
          placeX = layout.currentX;
          placeY = layout.y - h / 2;
          layout.currentX += w + (layout.gapX || 0);
          layout.lastRowHeight = Math.max(layout.lastRowHeight || 0, h);
        }

        const imgObj = {
          id: genId(),
          img,
          src: reader.result,
          x: placeX,
          y: placeY,
          width: w,
          height: h,
          layer: targetLayer,
          order: orderCounter++,
          user: currentUser,
          rotation: 0,
          imageName: file.name ? file.name.replace(/\.[^.]+$/, "") : "",
          imageListOrder: bumpImageListOrderCounter(),
        };
        images.push(imgObj);
        registerUser(currentUser);
        refreshImageList();
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

  async function addImageFilesAt(files, worldX, worldY, targetLayer = getImageTargetLayer()) {
    const imageFiles = Array.from(files || []).filter((file) => file.type && file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const gapX = 6 / scale;
    const gapY = 16 / scale;
    const perRow = 4;
    const layout = {
      startX: worldX,
      currentX: worldX,
      y: worldY,
      gapX,
      gapY,
      count: 0,
      perRow,
      lastRowHeight: 0,
    };

    for (const file of imageFiles) {
      try {
        const { img, src } = await loadImageFromFile(file);
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
          x: layout.currentX,
          y: layout.y - h / 2,
          width: w,
          height: h,
          layer: targetLayer,
          order: orderCounter++,
          user: currentUser,
          rotation: 0,
          imageName: file.name ? file.name.replace(/\.[^.]+$/, "") : "",
          imageListOrder: bumpImageListOrderCounter(),
        };
        images.push(imgObj);
        registerUser(currentUser);
        refreshImageList();
        emitImageAdd(imgObj);

        selected = { type: "image", index: images.length - 1 };
        layout.currentX += w + gapX;
        layout.lastRowHeight = Math.max(layout.lastRowHeight, h);
        layout.count += 1;
        if (layout.count % perRow === 0) {
          layout.currentX = layout.startX;
          layout.y += layout.lastRowHeight + gapY;
          layout.lastRowHeight = 0;
        }
      } catch (err) {
        console.error("failed to load image", err);
      }
    }

    currentTool = "select";
    updateToolButtons();
    redraw();
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve({ img, src: reader.result });
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
        rotation: imgObj.rotation || 0,
        tagType: imgObj.tagType || null,
        tagLabel: imgObj.tagLabel || "",
        imageName: imgObj.imageName || "",
        imageListOrder:
          typeof imgObj.imageListOrder === "number" ? imgObj.imageListOrder : imgObj.order || 0,
      },
    });
  }

  function addTemplateImage(src, worldX, worldY, targetLayer = getImageTargetLayer(), imageName = "") {
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
        layer: targetLayer,
        order: orderCounter++,
        user: currentUser,
        rotation: 0,
        imageName,
        imageListOrder: bumpImageListOrderCounter(),
      };
      images.push(imgObj);
      registerUser(currentUser);
      refreshImageList();
      emitImageAdd(imgObj);

      currentTool = "select";
      updateToolButtons();
      selected = { type: "image", index: images.length - 1 };
      redraw();
    };
    img.src = src;
  }

  function insertSideTag(type) {
    ensureSnapshotForAction();
    const dataUrl = createSideTag(type);
    if (!dataUrl) return;
    const center = getCanvasCenterWorld();
    const img = new Image();
    img.onload = () => {
      const w = img.width / scale;
      const h = img.height / scale;
      // 既存の画像レイヤー内で最小の order よりさらに小さい値を付与して最背面に
      const imageLayerOrders = images.filter((it) => (it.layer || "image") === "image").map((it) => it.order ?? 0);
      const minOrder = imageLayerOrders.length ? Math.min(...imageLayerOrders) : 0;
      const order = minOrder - 1;
      const imgObj = {
        id: genId(),
        img,
        src: dataUrl,
        x: center.x - w / 2,
        y: center.y - h / 2,
        width: w,
        height: h,
        layer: "image",
        order,
        user: currentUser,
        rotation: 0,
        imageName: type === "omote" ? "表" : "裏",
        imageListOrder: bumpImageListOrderCounter(),
      };
      images.push(imgObj);
      registerUser(currentUser);
      refreshImageList();
      emitImageAdd(imgObj);
      currentTool = "select";
      updateToolButtons();
      selected = { type: "image", index: images.length - 1 };
      redraw();
    };
    img.src = dataUrl;
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
        rotation: imgObj.rotation || 0,
        tagType: imgObj.tagType || null,
        tagLabel: imgObj.tagLabel || "",
        imageName: imgObj.imageName || "",
        imageListOrder:
          typeof imgObj.imageListOrder === "number" ? imgObj.imageListOrder : imgObj.order || 0,
      },
    });
  }

  // --- テキスト入力 ---
  function createTextEditorAt(screenX, screenY, initialValue = "") {
    if (!requireUser()) return;
    if (activeLayer === "image") return;
    pendingTextPos = null;
    const presetLabel = findImageNameAtScreenPoint(screenX, screenY);

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
    const baseColor = normalizeHexColor(textDefaultColor);
    textarea.style.color = lightenColor(baseColor);
    textarea.style.textShadow = buildTextShadow(baseColor, fontSizePx);

    textarea.value = initialValue || "";
    container.appendChild(textarea);
    textarea.focus();
    textEditor = textarea;
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (textEditor !== textarea) return;
      const value = textarea.value;
      const rect = textarea.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sx = rect.left - containerRect.left;
      const sy = rect.top - containerRect.top;
      const worldPos = screenToWorld(sx, sy);

      textarea.remove();
      textEditor = null;

      if (value.trim()) {
        ensureSnapshotForAction();
        const lines = value.split(/\r?\n/);
    const t = {
      id: genId(),
      lines,
      x: worldPos.x,
      y: worldPos.y,
      fontSize: fontSizeWorld,
      color: textDefaultColor,
      user: currentUser,
      layer:
        activeLayer === "base"
          ? "base"
          : activeLayer === "admin"
          ? "admin"
          : activeLayer === "draft"
          ? "draft"
          : "user",
      order: orderCounter++,
      createdAt: Date.now(),
      label: presetLabel,
      rotation: 0,
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

  function editTextAt(index) {
    const t = texts[index];
    if (!t) return;
    if (!canInteractText(t)) return;
    if (textEditor) {
      textEditor.remove();
      textEditor = null;
    }
    const base = worldToScreen(t.x, t.y);
    const fontSizeWorld = t.fontSize || 16;
    const fontSizePx = fontSizeWorld * scale;
    const textarea = document.createElement("textarea");
    textarea.className = "text-editor-overlay";
    textarea.style.left = `${base.x}px`;
    textarea.style.top = `${base.y}px`;
    textarea.style.width = `240px`;
    textarea.style.height = `${fontSizePx * 1.2 * Math.max(1, t.lines.length) + 8}px`;
    textarea.style.fontSize = `${fontSizePx}px`;
    const baseColor = normalizeHexColor(t.color || "#000000");
    textarea.style.color = lightenColor(baseColor);
    textarea.style.textShadow = buildTextShadow(baseColor, fontSizePx);
    textarea.value = t.lines.join("\n");
    container.appendChild(textarea);
    textarea.focus();
    textEditor = textarea;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (textEditor !== textarea) return;
      const value = textarea.value;
      textarea.remove();
      textEditor = null;
      const trimmed = value.trim();
      if (!trimmed) {
        // 空なら削除
        const removed = texts.splice(index, 1)[0];
        refreshTextList();
        redraw();
        if (removed && socketConnected) {
          socket.emit("item:remove", { boardId, type: "text", id: removed.id });
        }
        return;
      }
      const lines = value.split(/\r?\n/);
      texts[index] = {
        ...t,
        lines,
        layer: t.layer,
      };
      refreshTextList();
      redraw();
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: t.id,
          patch: { lines },
        });
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
    if (activeLayer !== "user" && activeLayer !== "admin") return;
    const lines = text.split(/\r?\n/);
    const t = {
      id: genId(),
      lines,
      x: worldX,
      y: worldY,
      fontSize: textDefaultFontSizeWorld || 16,
      color: textDefaultColor,
      user: currentUser,
      layer:
        activeLayer === "base"
          ? "base"
          : activeLayer === "admin"
          ? "admin"
          : activeLayer === "draft"
          ? "draft"
          : "user",
      order: orderCounter++,
      createdAt: Date.now(),
      label: "",
      rotation: 0,
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
    actionSnapshotTaken = false;
    closeMobileToolbarIfNeeded(e);
    if (e.touches && e.touches.length >= 2) {
      startPinchGesture(e);
      return;
    }

    if (framePlaceType && e.button === 0) {
      e.preventDefault();
      ensureSnapshotForAction();
      const canvasPos = getCanvasPointFromEvent(e);
      framePlaceStart = screenToWorld(canvasPos.x, canvasPos.y);
      framePlacePreview = null;
      isPlacingFrame = true;
      return;
    }

    // テキストエディタ表示中に外側をクリック/タップしたら確定
    if (textEditor && e.target !== textEditor) {
      textEditor.blur();
      return;
    }

    if (shapeMode && e.button === 0) {
      e.preventDefault();
      ensureSnapshotForAction();
      const canvasPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      shapeTargetLayer = getShapeTargetLayer();
      shapeStart = worldPos;
      shapePreview = null;
      isDrawingShape = true;
      return;
    }

    e.preventDefault();
    hideContextMenu();

    const canvasPos = getCanvasPointFromEvent(e);
    lastMouseScreen = { x: canvasPos.x, y: canvasPos.y };
    pendingTextPos = null;
    const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
    const isRightButton = e.button === 2;

    if (e.button === 0 && e.ctrlKey) {
      e.preventDefault();
      const wasSelected = selectAtPoint(canvasPos);
      if (wasSelected) {
        rotateSelection(activeCtrlSide === "right" ? "ccw" : "cw");
        return;
      }
    }

    if (e.button === 0 && e.detail >= 2) {
      ignoreNextDblClick = true;
      const frameIndex = hitTestFrameLabel(canvasPos.x, canvasPos.y);
      if (frameIndex >= 0 && editFrameLabelAt(frameIndex)) {
        return;
      }
      const textIndex = hitTestText(canvasPos.x, canvasPos.y);
      if (textIndex >= 0) {
        editTextAt(textIndex);
        return;
      }
      if (activeLayer !== "image" && requireUser()) {
        createTextEditorAt(canvasPos.x, canvasPos.y);
      }
      return;
    }

    if (isRightButton) {
      rightButtonDown = true;
      rightButtonStart = { x: e.clientX, y: e.clientY, canvas: canvasPos };
      hideContextMenu();
      return;
    }

    // 右クリック → パン
    if (e.button === 2) {
      const hasSel = getSelectionItems().length > 0;
      hideContextMenu();
      let found = hasSel;
      if (!found) {
        found = selectAtPoint(canvasPos);
      }
      if (found) {
    showContextMenu(e.clientX, e.clientY);
      } else {
        isPanning = true;
        lastPan = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    // 既存の範囲選択をドラッグ
    if (
      multiSelection &&
      multiSelection.rectWorld &&
      pointInRectWorld(multiSelection.rectWorld, worldPos)
    ) {
      ensureSnapshotForAction();
      multiDragActive = true;
      multiDragStartWorld = worldPos;
      multiDragOffsets =
        multiSelection.items?.map((it) => {
          if (it.type === "stroke") {
            const s = strokes[it.index];
            return { type: "stroke", index: it.index, points: s ? s.points.map((p) => ({ ...p })) : [] };
          } else if (it.type === "stroke-group") {
            const pts = {};
            it.indices.forEach((idx) => {
              const s = strokes[idx];
              if (s) pts[idx] = s.points.map((p) => ({ ...p }));
            });
            return { type: "stroke-group", indices: it.indices.slice(), points: pts };
          } else if (it.type === "text") {
            const t = texts[it.index];
            return { type: "text", index: it.index, x: t?.x, y: t?.y };
          } else if (it.type === "image") {
            const img = images[it.index];
            return { type: "image", index: it.index, x: img?.x, y: img?.y };
          } else if (it.type === "draft") {
            const s = draftStrokes[it.index];
            return { type: "draft", index: it.index, points: s ? s.points.map((p) => ({ ...p })) : [] };
          } else if (it.type === "draft-group") {
            const pts = {};
            it.indices.forEach((idx) => {
              const s = draftStrokes[idx];
              if (s) pts[idx] = s.points.map((p) => ({ ...p }));
            });
            return { type: "draft-group", indices: it.indices.slice(), points: pts };
          }
          return null;
        }) || [];
      return;
    }

    if (currentTool === "fill") {
      if (!requireUser()) return;
      fillClosedStrokeAt(worldPos);
      return;
    }

    // 消しゴム
    if (currentTool === "eraser") {
      if (!requireUser()) return;
      ensureSnapshotForAction();
      if (
        activeLayer !== "user" &&
        activeLayer !== "admin" &&
        activeLayer !== "draft" &&
        !(activeLayer === "image" && isAdminUser())
      )
        return;
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      selected = null;
      isErasing = true;
      eraseAt(worldPos.x, worldPos.y);
      return;
    }

    // 選択ツールでないときは、ペン専用
    if (currentTool !== "select") {
      if (!requireUser()) return;
      ensureSnapshotForAction();
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      if (activeLayer === "draft") {
        const baseColor = withAlpha(currentColor, 0.55);
        const stroke = {
          id: genId(),
          color: baseColor,
          size: currentSize,
          points: [worldPos],
          user: currentUser,
          order: draftOrderCounter++,
          createdAt: Date.now(),
        };
        draftStrokes.push(stroke);
        activeDraftId = stroke.id;
        isDrawing = true;
        isDrawingDraft = true;
      } else {
        if (
          activeLayer !== "user" &&
          activeLayer !== "admin" &&
          activeLayer !== "base" &&
          !(activeLayer === "image" && isAdminUser())
        )
          return;
        const stroke = {
          id: genId(),
          color: currentColor,
          size: currentSize,
          points: [worldPos],
          user: currentUser,
          layer:
            activeLayer === "base"
              ? "base"
              : activeLayer === "admin"
              ? "admin"
              : activeLayer === "image"
              ? "image"
              : "user",
          order: orderCounter++,
        };
        strokes.push(stroke);
        registerUser(currentUser);
        activeStrokeId = stroke.id;
        isDrawing = true;
        isDrawingDraft = false;
      }
      redraw();
      return;
    }

    // 以下、選択ツール時の処理
    // テキストのリサイズハンドル
    const textHandleIndex = hitTestTextResizeHandle(canvasPos.x, canvasPos.y);
    if (textHandleIndex >= 0) {
      ensureSnapshotForAction();
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
    const imgHandle = hitTestImageResizeHandle(canvasPos.x, canvasPos.y);
    if (imgHandle) {
      ensureSnapshotForAction();
      selected = { type: "image", index: imgHandle.index };
      const imgObj = images[imgHandle.index];
      const rect = { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height };
      const anchor =
        imgHandle.handle === "tl"
          ? { x: rect.x + rect.width, y: rect.y + rect.height }
          : imgHandle.handle === "tr"
          ? { x: rect.x, y: rect.y + rect.height }
          : imgHandle.handle === "bl"
          ? { x: rect.x + rect.width, y: rect.y }
          : { x: rect.x, y: rect.y };
      resizeInfo = {
        type: "image",
        index: imgHandle.index,
        anchorX: anchor.x,
        anchorY: anchor.y,
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
      ensureSnapshotForAction();
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
      ensureSnapshotForAction();
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

    // ストローク本体ヒット
    const strokeIndex = hitTestStroke(canvasPos.x, canvasPos.y, (s) => isStrokeVisible(s) || activeLayer === "draft");
    if (strokeIndex >= 0) {
      ensureSnapshotForAction();
      selected = getStrokeGroupSelection(strokeIndex);
      const s = strokes[strokeIndex];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - (s.points[0]?.x || worldPos.x),
        y: worldPos.y - (s.points[0]?.y || worldPos.y),
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    // 自分の下書きヒット（下書きレイヤーのみ）
    if (activeLayer === "draft") {
      const draftIndex = hitTestDraftStroke(canvasPos.x, canvasPos.y);
      if (draftIndex >= 0) {
        ensureSnapshotForAction();
        selected = getDraftGroupSelection(draftIndex);
        const s =
          selected?.type === "draft-group"
            ? draftStrokes[selected.indices[0]]
            : draftStrokes[draftIndex];
        const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
        dragOffsetWorld = {
          x: worldPos.x - (s.points[0]?.x || worldPos.x),
          y: worldPos.y - (s.points[0]?.y || worldPos.y),
        };
        isDraggingObject = true;
        redraw();
        return;
      }
    }

    // 何もない場所 → 範囲選択の開始点として扱う
    selectionDragActive = true;
    isSelectingArea = false;
    selectionDragStart = canvasPos;
    selectionDragCurrent = canvasPos;
    selected = null;
    multiSelection = null;
    pendingTextPos = null;
    redraw();
    updateFooterByState();
  }

  function handlePointerMove(e) {
    if (!pinchActive && e.touches && e.touches.length === 1) {
      closeMobileToolbarIfNeeded(e);
    }
    if (e.touches && e.touches.length >= 2) {
      if (!pinchActive) {
        startPinchGesture(e);
      } else {
        handlePinchMove(e);
      }
      return;
    }
    if (pinchActive && (!e.touches || e.touches.length < 2)) {
      pinchActive = false;
    }

    const canvasPos = getCanvasPointFromEvent(e);
    lastMouseScreen = { x: canvasPos.x, y: canvasPos.y };

    if (isPlacingFrame && framePlaceStart) {
      framePlacePreview = screenToWorld(canvasPos.x, canvasPos.y);
      redraw();
      return;
    }

    if (isDrawingShape && shapeMode && shapeStart) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      shapePreview = worldPos;
      redraw();
      return;
    }

    // 右ドラッグでパンを開始
    if (
      rightButtonDown &&
      !isPanning &&
      rightButtonStart &&
      Math.hypot(e.clientX - rightButtonStart.x, e.clientY - rightButtonStart.y) > CONTEXT_DRAG_THRESHOLD
    ) {
      isPanning = true;
      lastPan = { x: e.clientX, y: e.clientY };
      hideContextMenu();
    }

    if (selectionDragActive) {
      const dx = canvasPos.x - selectionDragStart.x;
      const dy = canvasPos.y - selectionDragStart.y;
      if (!isSelectingArea && Math.hypot(dx, dy) > 4) {
        isSelectingArea = true;
        pendingTextPos = null;
        multiSelection = null;
      }
      if (isSelectingArea) {
        selectionDragCurrent = canvasPos;
        e.preventDefault();
        redraw();
        return;
      }
    }

    if (multiDragActive && multiDragOffsets) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const dx = worldPos.x - (multiDragStartWorld?.x || worldPos.x);
      const dy = worldPos.y - (multiDragStartWorld?.y || worldPos.y);
      multiDragOffsets.forEach((it) => {
        if (!it) return;
        if (it.type === "stroke") {
          const s = strokes[it.index];
          if (!s || !it.points) return;
          s.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        } else if (it.type === "stroke-group") {
          it.indices.forEach((idx) => {
            const s = strokes[idx];
            const base = it.points?.[idx];
            if (!s || !base) return;
            s.points = base.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          });
        } else if (it.type === "text") {
          const t = texts[it.index];
          if (!t) return;
          t.x = (it.x || 0) + dx;
          t.y = (it.y || 0) + dy;
        } else if (it.type === "image") {
          const img = images[it.index];
          if (!img) return;
          img.x = (it.x || 0) + dx;
          img.y = (it.y || 0) + dy;
        } else if (it.type === "draft") {
          const s = draftStrokes[it.index];
          if (!s || !it.points) return;
          s.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        } else if (it.type === "draft-group") {
          it.indices.forEach((idx) => {
            const s = draftStrokes[idx];
            const base = it.points?.[idx];
            if (!s || !base) return;
            s.points = base.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          });
        }
      });
      redraw();
      e.preventDefault();
      return;
    }

    if (!(isDrawing || isPanning || isDraggingObject || isResizingObject || isErasing)) {
      return;
    }
    e.preventDefault();

    if (isDrawing) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      if (isDrawingDraft) {
        const stroke = draftStrokes.find((s) => s.id === activeDraftId);
        if (!stroke) {
          isDrawing = false;
          isDrawingDraft = false;
          activeDraftId = null;
        } else {
          stroke.points.push(worldPos);
        }
      } else {
        const stroke = strokes.find((s) => s.id === activeStrokeId);
        if (!stroke) {
          isDrawing = false;
          activeStrokeId = null;
        } else {
          stroke.points.push(worldPos);
        }
      }
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
      } else if (selected.type === "stroke") {
        const s = strokes[selected.index];
        const dx = worldPos.x - dragOffsetWorld.x;
        const dy = worldPos.y - dragOffsetWorld.y;
        const diffX = dx - s.points[0].x;
        const diffY = dy - s.points[0].y;
        s.points = s.points.map((p) => ({ x: p.x + diffX, y: p.y + diffY }));
      } else if (selected.type === "draft") {
        const s = draftStrokes[selected.index];
        const dx = worldPos.x - dragOffsetWorld.x;
        const dy = worldPos.y - dragOffsetWorld.y;
        const diffX = dx - s.points[0].x;
        const diffY = dy - s.points[0].y;
        s.points = s.points.map((p) => ({ x: p.x + diffX, y: p.y + diffY }));
      } else if (selected.type === "draft-group") {
        const ref = draftStrokes[selected.indices[0]];
        const dx = worldPos.x - dragOffsetWorld.x;
        const dy = worldPos.y - dragOffsetWorld.y;
        const diffX = dx - ref.points[0].x;
        const diffY = dy - ref.points[0].y;
        selected.indices.forEach((idx) => {
          const st = draftStrokes[idx];
          if (!st) return;
          st.points = st.points.map((p) => ({ x: p.x + diffX, y: p.y + diffY }));
        });
      } else if (selected.type === "stroke-group") {
        const ref = strokes[selected.indices[0]];
        const dx = worldPos.x - dragOffsetWorld.x;
        const dy = worldPos.y - dragOffsetWorld.y;
        const diffX = dx - ref.points[0].x;
        const diffY = dy - ref.points[0].y;
        selected.indices.forEach((idx) => {
          const st = strokes[idx];
          if (!st) return;
          st.points = st.points.map((p) => ({ x: p.x + diffX, y: p.y + diffY }));
        });
      }
      redraw();
    }

    if (isResizingObject && resizeInfo && selected) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const dx = worldPos.x - resizeInfo.originX;
      const dy = worldPos.y - resizeInfo.originY;
      if (resizeInfo.type === "image") {
        const imgObj = images[resizeInfo.index];
        const anchorX = resizeInfo.anchorX ?? imgObj.x;
        const anchorY = resizeInfo.anchorY ?? imgObj.y;
        const newX = Math.min(anchorX, worldPos.x);
        const newY = Math.min(anchorY, worldPos.y);
        const newW = Math.max(Math.abs(worldPos.x - anchorX), 10);
        const newH = Math.max(Math.abs(worldPos.y - anchorY), 10);
        imgObj.x = newX;
        imgObj.y = newY;
        imgObj.width = newW;
        imgObj.height = newH;
      } else if (resizeInfo.type === "frame") {
        const fr = frames[resizeInfo.index];
        const anchorX = resizeInfo.anchorX ?? fr.x;
        const anchorY = resizeInfo.anchorY ?? fr.y;
        fr.x = Math.min(anchorX, worldPos.x);
        fr.y = Math.min(anchorY, worldPos.y);
        fr.width = Math.max(Math.abs(worldPos.x - anchorX), 10);
        fr.height = Math.max(Math.abs(worldPos.y - anchorY), 10);
      } else if (resizeInfo.type === "text") {
        const factor =
          Math.max(dx, dy, 10) / Math.max(resizeInfo.startW, resizeInfo.startH, 1);
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
    if (pinchActive) {
      if (!e.touches || e.touches.length < 2) {
        pinchActive = false;
      }
      isPanning = false;
    }

    const wasRightButton = e.button === 2 || (e.button === 0 && rightButtonDown);
    const rightDragDistance =
      rightButtonStart && wasRightButton
        ? Math.hypot(e.clientX - rightButtonStart.x, e.clientY - rightButtonStart.y)
        : 0;

    if (
      isDrawing ||
      isPanning ||
      isDraggingObject ||
      isResizingObject ||
      isErasing ||
      multiDragActive ||
      selectionDragActive ||
      isDrawingShape
    ) {
      e.preventDefault();
    }

    if (isDrawing) {
      if (isDrawingDraft && activeDraftId) {
        const stroke = draftStrokes.find((s) => s.id === activeDraftId);
        if (stroke && socketConnected) {
          socket.emit("draft:stroke:add", { boardId, stroke });
        }
      } else if (activeStrokeId) {
        const stroke = strokes.find((s) => s.id === activeStrokeId);
        if (stroke && socketConnected) {
          socket.emit("stroke:add", { boardId, stroke });
        }
      }
    }

    if (selectionDragActive) {
      if (isSelectingArea && selectionDragStart && selectionDragCurrent) {
        const rectScreen = {
          x: selectionDragStart.x,
          y: selectionDragStart.y,
          width: selectionDragCurrent.x - selectionDragStart.x,
          height: selectionDragCurrent.y - selectionDragStart.y,
        };
        applyLassoSelection(rectScreen);
      } else {
        selected = null;
        multiSelection = null;
        redraw();
        updateFooterByState();
      }
      selectionDragActive = false;
      isSelectingArea = false;
      selectionDragStart = null;
      selectionDragCurrent = null;
    }

    // リサイズが終わった時点で、テキストのフォントサイズをデフォルトに反映
    if (isResizingObject && resizeInfo && selected) {
      if (resizeInfo.type === "text" && selected.type === "text") {
        const t = texts[selected.index];
        textDefaultFontSizeWorld = t.fontSize;
      }
    }

    const resizedFrameImage =
      isResizingObject && selected?.type === "image" ? images[selected.index] : null;
    const frameResizeHandled = !!resizedFrameImage?.tagType;
    if (frameResizeHandled) {
      refreshFrameImageForCurrentSize(resizedFrameImage, { emit: socketConnected });
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
        } else if (selected.type === "stroke") {
          const s = strokes[selected.index];
          const patch = { points: s.points.map((p) => ({ x: p.x, y: p.y })) };
          socket.emit("item:update", {
            boardId,
            type: "stroke",
            id: s.id,
            patch,
          });
        } else if (selected.type === "stroke-group") {
          selected.indices.forEach((idx) => {
            const s = strokes[idx];
            if (!s) return;
            const patch = { points: s.points.map((p) => ({ x: p.x, y: p.y })) };
            socket.emit("item:update", {
              boardId,
              type: "stroke",
              id: s.id,
              patch,
            });
          });
        } else if (selected.type === "draft") {
          const s = draftStrokes[selected.index];
          if (s) {
            socket.emit("draft:stroke:add", { boardId, stroke: s });
          }
        } else if (selected.type === "draft-group") {
          selected.indices.forEach((idx) => {
            const s = draftStrokes[idx];
            if (s) {
              socket.emit("draft:stroke:add", { boardId, stroke: s });
            }
          });
        }
      }
      if (isResizingObject) {
        if (selected.type === "image") {
          const imgObj = images[selected.index];
          if (!frameResizeHandled) {
            socket.emit("item:update", {
              boardId,
              type: "image",
              id: imgObj.id,
              patch: { width: imgObj.width, height: imgObj.height },
            });
          }
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
    if (multiDragActive && multiDragOffsets) {
      if (socketConnected) {
        multiDragOffsets.forEach((it) => {
          if (!it) return;
          if (it.type === "stroke") {
            const s = strokes[it.index];
            if (s) {
              socket.emit("item:update", {
                boardId,
                type: "stroke",
                id: s.id,
                patch: { points: s.points.map((p) => ({ x: p.x, y: p.y })) },
              });
            }
          } else if (it.type === "stroke-group") {
            it.indices.forEach((idx) => {
              const s = strokes[idx];
              if (!s) return;
              socket.emit("item:update", {
                boardId,
                type: "stroke",
                id: s.id,
                patch: { points: s.points.map((p) => ({ x: p.x, y: p.y })) },
              });
            });
          } else if (it.type === "text") {
            const t = texts[it.index];
            if (t) {
              socket.emit("item:update", {
                boardId,
                type: "text",
                id: t.id,
                patch: { x: t.x, y: t.y },
              });
            }
          } else if (it.type === "image") {
            const img = images[it.index];
            if (img) {
              socket.emit("item:update", {
                boardId,
                type: "image",
                id: img.id,
                patch: { x: img.x, y: img.y },
              });
            }
          } else if (it.type === "draft") {
            const s = draftStrokes[it.index];
            if (s) {
              socket.emit("draft:stroke:add", { boardId, stroke: s });
            }
          } else if (it.type === "draft-group") {
            it.indices.forEach((idx) => {
              const s = draftStrokes[idx];
              if (s) {
                socket.emit("draft:stroke:add", { boardId, stroke: s });
              }
            });
          }
        });
      }
    }

    isErasing = false;
    activeStrokeId = null;
    activeDraftId = null;
    isDrawingDraft = false;
    resizeInfo = null;
    multiDragActive = false;
    multiDragOffsets = null;
    multiDragStartWorld = null;
    actionSnapshotTaken = false;

    // 注目モード解除チェック
    if (attentionActive && !(e.ctrlKey && e.altKey && e.shiftKey)) {
      endAttention();
    }

    // 右クリックリリース時にコンテキストメニューを出す
    if (wasRightButton) {
      if (!isPanning && rightDragDistance <= CONTEXT_DRAG_THRESHOLD) {
        hideContextMenu();
        let hasSel = getSelectionItems().length > 0;
        if (!hasSel) {
          hasSel = selectAtPoint(rightButtonStart?.canvas || canvasPos);
        }
        if (hasSel) {
          showContextMenu(e.clientX, e.clientY);
        }
      }
      rightButtonDown = false;
      rightButtonStart = null;
    }

    if (isDrawingShape && shapeMode && shapeStart) {
      const upPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(upPos.x, upPos.y);
      const layer = shapeTargetLayer || getShapeTargetLayer();
      if (shapeMode === "line") {
        createStroke(
          [
            { x: shapeStart.x, y: shapeStart.y },
            { x: worldPos.x, y: worldPos.y },
          ],
          layer
        );
      } else if (shapeMode === "rect") {
        const x0 = Math.min(shapeStart.x, worldPos.x);
        const x1 = Math.max(shapeStart.x, worldPos.x);
        const y0 = Math.min(shapeStart.y, worldPos.y);
        const y1 = Math.max(shapeStart.y, worldPos.y);
        createStroke(
          [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
            { x: x0, y: y0 },
          ],
          layer
        );
      } else if (shapeMode === "grid") {
        const { x0, y0, x1, y1, side } = getSquareBoundsFromDrag(shapeStart, worldPos);
        const n = Math.max(2, shapeGridRows || shapeGridCols || 2);
        const step = side / n;
        const groupId = genId();
        for (let i = 0; i <= n; i++) {
          const y = y0 + step * i;
          createStroke(
            [
              { x: x0, y },
              { x: x1, y },
            ],
            layer,
            { groupId }
          );
        }
        for (let j = 0; j <= n; j++) {
          const x = x0 + step * j;
          createStroke(
            [
              { x, y: y0 },
              { x, y: y1 },
            ],
            layer,
            { groupId }
          );
        }
      }
      isDrawingShape = false;
      shapeStart = null;
      shapePreview = null;
      shapeGridRows = 0;
      shapeGridCols = 0;
      shapeTargetLayer = null;
      redraw();
    }

    if (isPlacingFrame && framePlaceStart) {
      const upPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(upPos.x, upPos.y);
      const x0 = framePlaceStart.x;
      const y0 = framePlaceStart.y;
      const x1 = worldPos.x;
      const y1 = worldPos.y;
      const width = Math.max(Math.abs(x1 - x0), 16);
      const height = Math.max(Math.abs(y1 - y0), 16);
      const placeX = Math.min(x0, x1);
      const placeY = Math.min(y0, y1);
      const placedFrameType = framePlaceType || "free";
      const label =
        placedFrameType === "free"
          ? `フレーム${frameCounter}`
          : placedFrameType === "omoteura"
          ? "表裏"
          : placedFrameType === "omote"
          ? "表"
          : "裏";
      if (placedFrameType === "free") {
        frameCounter += 1;
      }
      const dataUrl = createFrameTag(placedFrameType, width * scale, height * scale, label);
      const img = new Image();
      img.onload = () => {
        const imgObj = {
          id: genId(),
          img,
          src: dataUrl,
          x: placeX,
          y: placeY,
          width,
          height,
          layer: "image",
          order: orderCounter++,
          user: currentUser,
          rotation: 0,
          tagType: placedFrameType,
          tagLabel: label,
          imageName: label,
          imageListOrder: bumpImageListOrderCounter(),
        };
        images.push(imgObj);
        registerUser(currentUser);
        refreshImageList();
        emitImageAdd(imgObj);
        currentTool = "select";
        updateToolButtons();
        selected = { type: "image", index: images.length - 1 };
        redraw();
      };
      img.src = dataUrl;

      isPlacingFrame = false;
      framePlaceType = null;
      framePlaceStart = null;
      framePlacePreview = null;
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
    updateFooterByState();
  });

  function getImageFilesFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return [];
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return Array.from(dataTransfer.files).filter((file) => file.type && file.type.startsWith("image/"));
    }
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      return Array.from(dataTransfer.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file) => file && file.type && file.type.startsWith("image/"));
    }
    return [];
  }

  function handleImageDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleImageDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = getImageFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);
    addImageFilesAt(files, worldPos.x, worldPos.y, getImageTargetLayer());
  }

  // --- ドラッグ＆ドロップ（画像） ---
  [canvas, container].forEach((target) => {
    if (!target) return;
    target.addEventListener("dragover", handleImageDrag);
    target.addEventListener("dragenter", handleImageDrag);
    target.addEventListener("drop", handleImageDrop);
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
        addImageFile(file, worldPos.x, worldPos.y, null, getImageTargetLayer());
      }
      return;
    }

    const text = clipboard.getData("text");
    if (text) {
      e.preventDefault();
      if (activeLayer === "image") return;
      if (!requireUser()) return;
      addTextFromClipboard(text, worldPos.x, worldPos.y);
    }
  });

  // --- イベント登録 ---
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("click", () => hideMenusIfCompact());

  function isInsideToolbar(target) {
    if (!target) return false;
    if (toolbarEl && toolbarEl.contains(target)) return true;
    return false;
  }

  function closeMobileToolbarIfNeeded(e) {
    const target = e && e.target;
    if (isInsideToolbar(target)) return;
    document.body.classList.remove("mobile-menu-open");
  }

  function closeOtherMenu(delay = 0) {
    if (!otherMenu) return;
    const doClose = () => otherMenu.classList.add("hidden");
    if (delay > 0) {
      if (otherMenu._closeTimer) clearTimeout(otherMenu._closeTimer);
      otherMenu._closeTimer = setTimeout(doClose, delay);
    } else {
      if (otherMenu._closeTimer) {
        clearTimeout(otherMenu._closeTimer);
        otherMenu._closeTimer = null;
      }
      doClose();
    }
  }

  function openOtherMenu() {
    if (otherMenu) {
      if (otherMenu._closeTimer) {
        clearTimeout(otherMenu._closeTimer);
        otherMenu._closeTimer = null;
      }
      otherMenu.classList.remove("hidden");
    }
  }

  function toggleOtherMenu() {
    if (!otherMenu) return;
    if (otherMenu.classList.contains("hidden")) {
      openOtherMenu();
    } else {
      closeOtherMenu();
    }
  }

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
    if (e.key === "Control") {
      activeCtrlSide = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? "right" : "left";
    }
    updateFooterByState();
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

    if (
      e.key === "Control" &&
      !e.repeat &&
      !e.altKey &&
      !e.shiftKey &&
      !e.metaKey &&
      getSelectionItems().length > 0
    ) {
      e.preventDefault();
      rotateSelection(activeCtrlSide === "right" ? "ccw" : "cw");
      return;
    }

    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undoLast();
      return;
    }

    // Delete/Backspace: 選択削除
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelection();
      return;
    }

    // Ctrl+D: 画像複製
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateSelectedImages();
      return;
    }

    pendingTextPos = null;
  });

  canvas.addEventListener("dblclick", (e) => {
    if (ignoreNextDblClick) {
      ignoreNextDblClick = false;
      e.preventDefault();
      return;
    }
    if (textEditor) return;
    e.preventDefault();
    const canvasPos = getCanvasPointFromEvent(e);
    const frameIndex = hitTestFrameLabel(canvasPos.x, canvasPos.y);
    if (frameIndex >= 0 && editFrameLabelAt(frameIndex)) {
      return;
    }
    const textIndex = hitTestText(canvasPos.x, canvasPos.y);
    if (textIndex >= 0) {
      editTextAt(textIndex);
      return;
    }
    if (activeLayer === "image") return;
    if (!requireUser()) return;
    e.preventDefault();
    createTextEditorAt(canvasPos.x, canvasPos.y);
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Control") {
      const releasedSide = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? "right" : "left";
      if (activeCtrlSide === releasedSide) activeCtrlSide = null;
    }
    if (attentionActive && !(e.ctrlKey && e.altKey && e.shiftKey)) {
      endAttention();
    }
  });

  window.addEventListener("blur", () => {
    activeCtrlSide = null;
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

  function getSelectionItems() {
    if (multiSelection && multiSelection.items) return multiSelection.items;
    if (selected) return [selected];
    return [];
  }

  function selectAtPoint(canvasPos) {
    // テキストリサイズ
    const textHandleIndex = hitTestTextResizeHandle(canvasPos.x, canvasPos.y);
    if (textHandleIndex >= 0) {
      selected = { type: "text", index: textHandleIndex };
      redraw();
      return true;
    }
    // 画像リサイズ
    const imgHandle = hitTestImageResizeHandle(canvasPos.x, canvasPos.y);
    if (imgHandle) {
      selected = { type: "image", index: imgHandle.index };
      redraw();
      return true;
    }
    // テキスト本体
    const textIndex = hitTestText(canvasPos.x, canvasPos.y);
    if (textIndex >= 0) {
      selected = { type: "text", index: textIndex };
      redraw();
      return true;
    }
    // 画像本体
    const imgIndex = hitTestImage(canvasPos.x, canvasPos.y);
    if (imgIndex >= 0) {
      selected = { type: "image", index: imgIndex };
      redraw();
      return true;
    }

    // ストローク本体
    const strokeIndex = hitTestStroke(canvasPos.x, canvasPos.y, (s) => isStrokeVisible(s) || activeLayer === "draft");
    if (strokeIndex >= 0) {
      selected = getStrokeGroupSelection(strokeIndex);
      redraw();
      return true;
    }

    // 下書きストローク（自分のみ）
    if (activeLayer === "draft") {
      const draftIndex = hitTestDraftStroke(canvasPos.x, canvasPos.y);
      if (draftIndex >= 0) {
        selected = getDraftGroupSelection(draftIndex);
        redraw();
        return true;
      }
    }
    return false;
  }

  function selectionHasDraft() {
    return getSelectionItems().some((it) => it.type === "draft" || it.type === "draft-group");
  }

  function selectionHasStrokeOrText() {
    return getSelectionItems().some((it) => it.type === "stroke" || it.type === "stroke-group" || it.type === "text");
  }

  function selectionHasImage() {
    return getSelectionItems().some((it) => it.type === "image");
  }

  function getSelectedImages() {
    return getSelectionItems()
      .filter((it) => it.type === "image")
      .map((it) => images[it.index])
      .filter(Boolean);
  }

  function setSelectedImageName() {
    const targets = getSelectedImages();
    if (!targets.length) return;
    const current = targets.length === 1 ? targets[0].imageName || "" : "";
    const next = window.prompt(
      targets.length === 1 ? "画像名を入力" : "選択中の画像名をまとめて入力",
      current
    );
    if (next === null) return;
    const imageName = next.trim();
    targets.forEach((imgObj) => {
      imgObj.imageName = imageName;
      emitItemPatch("image", imgObj, { imageName });
    });
    refreshImageList();
  }

  function selectionHasOrderable() {
    return collectOrderableSelectionItems().length > 0;
  }

  function selectionHasRotatable() {
    return getSelectionItems().some((it) => it.type === "stroke" || it.type === "stroke-group" || it.type === "draft" || it.type === "draft-group" || it.type === "text" || it.type === "image");
  }

  function selectionHasDraftCopyTarget() {
    return getSelectionItems().some((it) => it.type === "stroke" || it.type === "stroke-group" || it.type === "text");
  }

  function updateToolButtons() {
    const isPen = currentTool === "pen";
    const isFill = currentTool === "fill";
    const isEraser = currentTool === "eraser";
    const isSelect = currentTool === "select" && !shapeMode;
    const isShapeLine = shapeMode === "line";
    const isShapeRect = shapeMode === "rect";
    const isShapeGrid = shapeMode === "grid";
    if (penToolBtn) {
      penToolBtn.disabled = isPen;
      penToolBtn.classList.toggle("active", isPen);
    }
    if (fillToolBtn) {
      fillToolBtn.disabled = isFill;
      fillToolBtn.classList.toggle("active", isFill);
    }
    if (eraserToolBtn) {
      eraserToolBtn.disabled = isEraser;
      eraserToolBtn.classList.toggle("active", isEraser);
    }
    if (selectToolBtn) {
      selectToolBtn.disabled = isSelect;
      selectToolBtn.classList.toggle("active", isSelect);
    }
    if (shapeLineBtn) {
      shapeLineBtn.classList.toggle("active", isShapeLine);
    }
    if (shapeRectBtn) {
      shapeRectBtn.classList.toggle("active", isShapeRect);
    }
    if (shapeGridBtn) {
      shapeGridBtn.classList.toggle("active", isShapeGrid);
    }
    if (currentTool === "pen" || currentTool === "eraser" || currentTool === "fill") {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "default";
    }
  }
  updateToolButtons();

  // --- ユーザーモーダル ---
  userJoinBtn.addEventListener("click", () => {
    const name = userNameInput.value.trim();
    if (!name) {
      window.alert("ユーザー名を入力してください。");
      userNameInput.focus();
      return;
    }
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

    if (currentUser) {
      setProfileFavoriteColor(currentUser, newColor);
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
    if (!historyStack.length) return;
    const snap = historyStack.pop();
    restoreSnapshot(snap);
  }

  colorPicker.addEventListener("input", () => {
    const c = colorPicker.value;
    const swatch = getActiveColorSwatch();
    if (swatch) {
      swatches.forEach((btn) => btn.classList.remove("selected"));
      swatch.classList.add("selected");
      activeColorSwatch = swatch;
      setPaletteItemColor(swatch, c);
    }
    applyNewColor(c);
  });

  swatches.forEach((btn, index) => {
    const c = paletteColors[index] || btn.getAttribute("data-color");
    setPaletteItemColor(btn, c);
    btn.style.backgroundColor = c;
    btn.addEventListener("click", () => {
      const c = btn.getAttribute("data-color");
      colorPicker.value = c;
      swatches.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      activeColorSwatch = btn;
      applyNewColor(c);
    });
  });
  // デフォルトカラーにチェック
  if (swatches[0]) {
    swatches[0].classList.add("selected");
    activeColorSwatch = swatches[0];
    currentColor = swatches[0].getAttribute("data-color") || currentColor;
    colorPicker.value = currentColor;
  }

  favButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!requireUser()) return;
      const c = btn.getAttribute("data-color");
      const currentFav = favoritesByUser[currentUser];
      if (currentFav === c) {
        delete favoritesByUser[currentUser];
        setProfileFavoriteColor(currentUser, null);
      } else {
        favoritesByUser[currentUser] = c;
        setProfileFavoriteColor(currentUser, c);
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
    lastUserLayerTool = "pen";
    selected = null;
    updateToolButtons();
    redraw();
    showTransientFooterMessage("ペン：このレイヤーに描いた線は共有されます。", 5000);
    resetShapeMode();
  });

  if (fillToolBtn) {
    fillToolBtn.addEventListener("click", () => {
      if (!requireUser()) return;
      if (activeLayer === "image") {
        setActiveLayer(isAdminUser() ? "admin" : "user");
      }
      currentTool = "fill";
      lastUserLayerTool = "fill";
      selected = null;
      updateToolButtons();
      redraw();
      showTransientFooterMessage("塗りつぶし：閉じた線の内側をクリックしてください。", 5000);
      resetShapeMode();
    });
  }

  eraserToolBtn.addEventListener("click", () => {
    if (!requireUser()) return;
    if (activeLayer === "image") {
      setActiveLayer(isAdminUser() ? "admin" : "user");
    }
    currentTool = "eraser";
    lastUserLayerTool = "eraser";
    selected = null;
    updateToolButtons();
    showTransientFooterMessage("消しゴム：線に触れると一筆単位で削除されます。画像やテキストは消えません。", 5000);
    resetShapeMode();
  });

  selectToolBtn.addEventListener("click", () => {
    currentTool = "select";
    updateToolButtons();
    showTransientFooterMessage("選択ツール：右クリックでメニューを開けます。", 5000);
    resetShapeMode();
  });

  textListBtn.addEventListener("click", toggleTextListPanelView);

  if (imageListBtn) {
    imageListBtn.addEventListener("click", toggleImageListPanelView);
  }

  textListCloseBtn.addEventListener("click", () => {
    closeTextList();
  });

  if (imageListCloseBtn) {
    imageListCloseBtn.addEventListener("click", () => {
      closeImageList();
    });
  }

  if (textListCopyTaggedBtn) {
    textListCopyTaggedBtn.addEventListener("click", () => {
      copyTextList(buildTextListTaggedText());
    });
  }

  if (textListCopyPlainBtn) {
    textListCopyPlainBtn.addEventListener("click", () => {
      copyTextList(buildTextListPlainText());
    });
  }

  if (imageFileInput) {
    imageFileInput.addEventListener("change", () => {
      const files = Array.from(imageFileInput.files || []);
      if (!files.length) return;
      const center = getCanvasCenterWorld();
      const targetLayer = pendingImageInsertLayer || getImageTargetLayer();
      pendingImageInsertLayer = null;
      addImageFilesAt(files, center.x, center.y, targetLayer);
    });
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuVisible = !menuVisible;
      applyMenuVisibility();
    });
  }

  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.classList.add("hidden");
    }
  }

  function showContextMenu(x, y) {
    if (!contextMenu) return;
    const hasDraft = selectionHasDraft();
    const hasAny = getSelectionItems().length > 0;
    const hasImage = selectionHasImage();
    const hasMoveTarget = selectionHasStrokeOrText() && isAdminUser();
    const hasMoveImageTarget = hasImage && isAdminUser();
    const hasOrderable = selectionHasOrderable();
    const hasRotatable = selectionHasRotatable();
    const hasDraftCopyTarget = selectionHasDraftCopyTarget();

    contextMenu.querySelectorAll("button").forEach((btn) => btn.classList.remove("disabled"));
    const applyBtn = contextMenu.querySelector('button[data-action="apply-draft"]');
    const moveBtn = contextMenu.querySelector('button[data-action="move-base"]');
    const moveImageBtn = contextMenu.querySelector('button[data-action="move-image"]');
    const renameImageBtn = contextMenu.querySelector('button[data-action="rename-image"]');
    const dupBtn = contextMenu.querySelector('button[data-action="duplicate"]');
    const frontBtn = contextMenu.querySelector('button[data-action="bring-front"]');
    const backBtn = contextMenu.querySelector('button[data-action="send-back"]');
    const rotateRightBtn = contextMenu.querySelector('button[data-action="rotate-right"]');
    const rotateLeftBtn = contextMenu.querySelector('button[data-action="rotate-left"]');
    const copyDraftBtn = contextMenu.querySelector('button[data-action="copy-draft"]');
    if (applyBtn && !hasDraft) applyBtn.classList.add("disabled");
    if (moveBtn && !hasMoveTarget) moveBtn.classList.add("disabled");
    if (moveImageBtn && !hasMoveImageTarget) moveImageBtn.classList.add("disabled");
    if (renameImageBtn && !hasImage) renameImageBtn.classList.add("disabled");
    if (frontBtn && !hasOrderable) frontBtn.classList.add("disabled");
    if (backBtn && !hasOrderable) backBtn.classList.add("disabled");
    if (rotateRightBtn && !hasRotatable) rotateRightBtn.classList.add("disabled");
    if (rotateLeftBtn && !hasRotatable) rotateLeftBtn.classList.add("disabled");
    if (copyDraftBtn && !hasDraftCopyTarget) copyDraftBtn.classList.add("disabled");
    if (dupBtn && !hasAny) dupBtn.classList.add("disabled");
    if (!hasAny) return;

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove("hidden");
  }

  if (contextMenu) {
    contextMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.classList.contains("disabled")) return;
      const action = btn.getAttribute("data-action");
      if (action === "apply-draft") {
        applyDraftSelectionToPublic();
      } else if (action === "delete") {
        deleteSelection();
      } else if (action === "duplicate") {
        duplicateSelectedImages();
      } else if (action === "move-base") {
        moveSelectionToBase();
      } else if (action === "move-image") {
        moveSelectionToImage();
      } else if (action === "rename-image") {
        setSelectedImageName();
      } else if (action === "bring-front") {
        moveSelectionOrder("front");
      } else if (action === "send-back") {
        moveSelectionOrder("back");
      } else if (action === "rotate-right") {
        rotateSelection("cw");
      } else if (action === "rotate-left") {
        rotateSelection("ccw");
      } else if (action === "copy-draft") {
        copySelectionToDraft();
      }
      hideContextMenu();
    });
  }

  window.addEventListener("click", (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  function updateFooterByState() {
    if (!footerHint) return;
    if (footerMessageTimer) {
      // 一時メッセージ期間中はそのまま
      return;
    }

    // 選択ツールの選択あり／なしを優先
    if (currentTool === "select") {
      const hasSelection = getSelectionItems().length > 0;
      if (hasSelection) {
        setFooterMessage("選択中：右クリックで「提出」または「削除」メニューを開けます。");
        return;
      } else {
        setFooterMessage("選択ツール：右クリックでメニューを開けます。");
        return;
      }
    }

    // 下書きレイヤー中（ツールは自由）
    if (activeLayer === "draft") {
      setFooterMessage(
        "下書きペン：このペンで描いた線はあなたにしか見えません。選択ツールで囲って右クリックすると提出できます。"
      );
      return;
    }

    // 消しゴム
    if (currentTool === "eraser") {
      setFooterMessage("消しゴム：線に触れると一筆単位で削除されます。画像やテキストは消えません。");
      return;
    }

    if (currentTool === "fill") {
      setFooterMessage("塗りつぶし：閉じた線の内側をクリックしてください。");
      return;
    }

    // デフォルト
    setFooterMessage("Ctrl + Alt + Shift でレーザーポインタを表示できます。（全員に見えます）");
  }

  function toggleStrokeAlpha() {
    strokesDimmed = !strokesDimmed;
    if (strokeAlphaToggleBtn) {
      strokeAlphaToggleBtn.textContent = "🧊";
    }
    redraw();
    showTransientFooterMessage(
      strokesDimmed ? "半透明：線を薄く表示中です。" : "半透明解除：線を通常の濃さで表示します。",
      4000
    );
  }

  strokeAlphaToggleBtn.addEventListener("click", () => {
    toggleStrokeAlpha();
  });

  if (changeUserBtn) {
    changeUserBtn.addEventListener("click", () => {
      closeOtherMenu();
      openUserModal();
    });
  }

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
  if (layerToggleBtn) {
    layerToggleBtn.addEventListener("click", (e) => {
      if (!currentUser && activeLayer === "user") {
        openUserModal();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleHiddenSharedLayer();
        return;
      }
      toggleActiveLayer();
    });
  }
  if (insertMenuBtn) {
    insertMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!templates) templates = [];
      renderInsertMenu();
      if (insertMenu && !insertMenu.classList.contains("hidden")) {
        closeInsertMenu();
      } else {
        openInsertMenu();
      }
    });
    insertMenuBtn.addEventListener("mouseenter", () => {
      if (!templates) templates = [];
      renderInsertMenu();
      openInsertMenu();
    });
    insertMenuBtn.addEventListener("mouseleave", () => {
      scheduleCloseInsertMenu();
    });
    if (insertMenu) {
      insertMenu.addEventListener("mouseleave", () => {
        scheduleCloseInsertMenu();
      });
      insertMenu.addEventListener("mouseenter", () => {
        if (insertMenuHideTimer) {
          clearTimeout(insertMenuHideTimer);
          insertMenuHideTimer = null;
        }
      });
    }
  }

  if (shapeLineBtn) {
    shapeLineBtn.addEventListener("click", () => {
      startShapeMode("line");
      updateToolButtons();
    });
  }
  if (shapeRectBtn) {
    shapeRectBtn.addEventListener("click", () => {
      startShapeMode("rect");
      updateToolButtons();
    });
  }
  if (shapeGridBtn) {
    shapeGridBtn.addEventListener("click", () => {
      startShapeMode("grid");
      updateToolButtons();
    });
  }

  if (otherMenuBtn) {
    otherMenuBtn.addEventListener("mouseenter", () => openOtherMenu());
    otherMenuBtn.addEventListener("mouseleave", () => closeOtherMenu(800));
    otherMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOtherMenu();
    });
  }
  if (otherMenu) {
    otherMenu.addEventListener("mouseenter", () => openOtherMenu());
    otherMenu.addEventListener("mouseleave", () => {
      closeInsertMenu();
      closeOtherMenu(800);
    });
  }

  window.addEventListener("click", (e) => {
    const target = e.target;
    const insideInsert =
      insertMenu &&
      insertMenuBtn &&
      (insertMenu.contains(target) || insertMenuBtn.contains(target));
    const insideOther =
      otherMenu &&
      otherMenuBtn &&
      (otherMenu.contains(target) || otherMenuBtn.contains(target));

    if (!insideInsert) closeInsertMenu();
    if (!insideOther) closeOtherMenu();
  });
  window.addEventListener("resize", () => {
    refreshCompactMode();
    positionTextListPanel();
    if (insertMenu && !insertMenu.classList.contains("hidden")) {
      positionInsertMenu();
    }
    positionImageListPanel();
  });
  // Undo（最後に追加したテキスト/ペン/画像を取り消し）
  undoBtn.addEventListener("click", undoLast);

  // 初期化
  updateBoardTitleDisplay();
  refreshUserDatalist();
  loadTemplates();
  updateLayerToggleUI();
  refreshCompactMode();
  updateFooterByState();
  loadBoardUsersFromServer();
  const lastUser = loadLastUser().trim();
  if (lastUser) {
    setCurrentUser(lastUser);
  } else {
    openUserModal();
  }
  function getShapeTargetLayer() {
    if (activeLayer === "image") return isAdminUser() ? "image" : "base";
    return activeLayer || "user";
  }

  function getCanvasCenterWorld() {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return screenToWorld(cx, cy);
  }

  function createStroke(points, layer, opts = {}) {
    const stroke = {
      id: genId(),
      color: currentColor,
      size: currentSize,
      points,
      user: currentUser,
      layer,
      order: orderCounter++,
      groupId: opts.groupId || null,
    };
    strokes.push(stroke);
    registerUser(currentUser);
    if (socketConnected) {
      socket.emit("stroke:add", { boardId, stroke });
    }
  }

  function startShapeMode(kind) {
    if (!requireUser()) return;
    shapeMode = kind; // "line" | "rect" | "grid"
    if (currentTool !== "select") {
      currentTool = "select";
      updateToolButtons();
    }
    shapeStart = null;
    shapePreview = null;
    shapeGridRows = 0;
    shapeGridCols = 0;
    shapeTargetLayer = null;
    if (kind === "grid") {
      let n = window.prompt("マス目の数 n を入力してください", "5");
      if (n === null) {
        shapeMode = null;
        return;
      }
      n = parseInt(n, 10);
      if (!Number.isFinite(n) || n < 2) n = 2;
      if (n > 30) n = 30;
      shapeGridRows = n;
      shapeGridCols = n;
    }
    closeInsertMenu();
    showTransientFooterMessage("ドラッグして形を配置できます。", 4000);
  }

  function insertTemplateImage(src) {
    if (!src) return;
    if (!requireUser()) return;
    const center = getCanvasCenterWorld();
    const name = src.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    addTemplateImage(src, center.x, center.y, getImageTargetLayer(), decodeURIComponent(name));
  }

  function chooseImageFiles() {
    if (!requireUser()) return;
    if (!imageFileInput) return;
    pendingImageInsertLayer = getImageTargetLayer();
    imageFileInput.value = "";
    imageFileInput.click();
  }

  function startFramePlacement(type) {
    if (!requireUser()) return;
    framePlaceType = type; // "omoteura" | "free"
    framePlaceStart = null;
    framePlacePreview = null;
    showTransientFooterMessage("ドラッグしてフレームの大きさを指定してください。", 4000);
    closeInsertMenu();
  }

  function renderInsertMenu() {
    if (!insertMenu) return;
    insertMenu.innerHTML = "";

    const addSection = (title, items) => {
      const sec = document.createElement("div");
      sec.className = "section";
      const h = document.createElement("div");
      h.className = "section-title";
      h.textContent = title;
      sec.appendChild(h);
      items.forEach((it) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.textContent = it.label;
        btn.addEventListener("click", () => {
          it.onClick();
          closeInsertMenu();
        });
        sec.appendChild(btn);
      });
      insertMenu.appendChild(sec);
    };

    addSection("図形", [
      { label: "直線", onClick: () => startShapeMode("line") },
      { label: "四角", onClick: () => startShapeMode("rect") },
      { label: "マス目 (n×n)", onClick: () => startShapeMode("grid") },
    ]);

    addSection("画像", [
      { label: "画像ファイル", onClick: () => chooseImageFiles() },
    ]);

    addSection("フレーム", [
      { label: "表裏", onClick: () => startFramePlacement("omoteura") },
      {
        label: `フレーム${frameCounter}`,
        onClick: () => {
          startFramePlacement("free");
        },
      },
    ]);

    if (templates && templates.length > 0) {
      addSection(
        "テンプレ画像",
        templates.map((filename) => {
          const src = `/templates/${filename}`;
          const name = filename.replace(/\.png$/i, "");
          return { label: name, onClick: () => insertTemplateImage(src) };
        })
      );
    }
  }

  function openInsertMenu() {
    if (!insertMenu || !insertMenuBtn) return;
    insertMenu.style.visibility = "hidden";
    insertMenu.classList.remove("hidden");
    positionInsertMenu();
    insertMenu.style.visibility = "";
  }

  function closeInsertMenu() {
    if (insertMenuHideTimer) {
      clearTimeout(insertMenuHideTimer);
      insertMenuHideTimer = null;
    }
    if (insertMenu) {
      insertMenu.classList.add("hidden");
      insertMenu.style.left = "";
      insertMenu.style.top = "";
      insertMenu.style.bottom = "";
      insertMenu.style.maxHeight = "";
    }
  }

  function positionInsertMenu() {
    if (!insertMenu || !insertMenuBtn) return;
    const margin = 8;

    const btnRect = insertMenuBtn.getBoundingClientRect();

    insertMenu.style.left = "0px";
    insertMenu.style.top = "0px";
    insertMenu.style.bottom = "auto";
    insertMenu.style.maxHeight = `${Math.max(180, window.innerHeight - margin * 2)}px`;

    const menuRect = insertMenu.getBoundingClientRect();

    const availableBelow = window.innerHeight - btnRect.bottom - margin;
    const availableAbove = btnRect.top - margin;
    const openUpwards = menuRect.height > availableBelow && availableAbove > availableBelow;

    let top;
    if (openUpwards) {
      const maxHeight = Math.max(180, availableAbove - margin);
      insertMenu.style.maxHeight = `${maxHeight}px`;
      top = btnRect.top - Math.min(menuRect.height, maxHeight) - margin;
    } else {
      const maxHeight = Math.max(180, availableBelow - margin);
      insertMenu.style.maxHeight = `${maxHeight}px`;
      top = btnRect.bottom + margin;
    }

    let left = btnRect.left;
    const maxLeft = window.innerWidth - menuRect.width - margin;
    left = Math.min(left, maxLeft);
    left = Math.max(margin, left);

    insertMenu.style.left = `${left}px`;
    insertMenu.style.top = `${Math.max(margin, top)}px`;
  }

  function scheduleCloseInsertMenu(delay = 150) {
    if (insertMenuHideTimer) clearTimeout(insertMenuHideTimer);
    insertMenuHideTimer = setTimeout(() => {
      closeInsertMenu();
    }, delay);
  }

  function resetShapeMode() {
    shapeMode = null;
    isDrawingShape = false;
    shapeStart = null;
    shapePreview = null;
    shapeGridRows = 0;
    shapeGridCols = 0;
    shapeTargetLayer = null;
    updateToolButtons();
  }

  // --- ここまで ---
})();
