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
  const lassoCopyToolBtn = document.getElementById("lasso-copy-tool-btn");
  const lassoCopyToolMenu = document.getElementById("lasso-copy-tool-menu");
  const strokeAlphaToggleBtn = document.getElementById("stroke-alpha-toggle-btn");
  const toolbarEl = document.getElementById("toolbar");
  const insertMenuBtn = document.getElementById("insert-menu-btn");
  const insertMenu = document.getElementById("insert-menu");
  const listMenuBtn = document.getElementById("list-menu-btn");
  const listMenu = document.getElementById("list-menu");
  const textListBtn = document.getElementById("text-list-btn");
  const imageListBtn = document.getElementById("image-list-btn");
  const linkListBtn = document.getElementById("link-list-btn");
  const textListPanel = document.getElementById("text-list-panel");
  const textListBody = document.getElementById("text-list-body");
  const textListCloseBtn = document.getElementById("text-list-close-btn");
  const textListCopyTaggedBtn = document.getElementById("text-list-copy-tagged-btn");
  const textListCopyPlainBtn = document.getElementById("text-list-copy-plain-btn");
  const textListDuplicateGridBtn = document.getElementById("text-list-duplicate-grid-btn");
  const textListStarOnly = document.getElementById("text-list-star-only");
  const textListSortKanaBtn = document.getElementById("text-list-sort-kana-btn");
  const textListSortTagBtn = document.getElementById("text-list-sort-tag-btn");
  const textListSortCreatedBtn = document.getElementById("text-list-sort-created-btn");
  const imageListPanel = document.getElementById("image-list-panel");
  const imageListBody = document.getElementById("image-list-body");
  const imageListCloseBtn = document.getElementById("image-list-close-btn");
  const linkListPanel = document.getElementById("link-list-panel");
  const linkListBody = document.getElementById("link-list-body");
  const linkListCloseBtn = document.getElementById("link-list-close-btn");
  const watchUsersBtn = document.getElementById("watch-users-btn");
  const watchUsersMenu = document.getElementById("watch-users-menu");
  const otherMenuBtn = document.getElementById("other-menu-btn");
  const otherMenu = document.getElementById("other-menu");
  const changeUserBtn = document.getElementById("change-user-btn");
  const layerDisplay = document.getElementById("layer-display");
  const textToolBtn = document.getElementById("text-tool-btn");
  const textToolMenu = document.getElementById("text-tool-menu");
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
  const frameDeleteModal = document.getElementById("frame-delete-modal");
  const frameDeleteContentsBtn = document.getElementById("frame-delete-contents-btn");
  const frameDeleteFrameOnlyBtn = document.getElementById("frame-delete-frame-only-btn");
  const frameDeleteCancelBtn = document.getElementById("frame-delete-cancel-btn");
  const screenShareView = document.getElementById("screen-share-view");
  const screenShareVideo = document.getElementById("screen-share-video");
  const screenShareLabel = document.getElementById("screen-share-label");
  const screenShareToggleBtn = document.getElementById("screen-share-toggle-btn");

  const ctx = canvas.getContext("2d");
  const frameTabTooltipEl = document.createElement("div");
  frameTabTooltipEl.className = "frame-tab-tooltip hidden";
  document.body.appendChild(frameTabTooltipEl);

  // --- ボードID表示 ---
  const boardId = window.location.pathname.split("/").pop();
  const viewParams = new URLSearchParams(window.location.search);
  const followTargetUser = viewParams.get("follow") || "";
  const linkBoardView = (() => {
    const raw = viewParams.get("linkBoard");
    if (!raw) return null;
    try {
      const rect = JSON.parse(raw);
      if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return null;
      if (rect.width <= 0 || rect.height <= 0) return null;
      return rect;
    } catch {
      return null;
    }
  })();
  const draftBoardViewId = viewParams.get("draftBoard") || "";
  const isDetachedBoardView = !!followTargetUser;
  const userStorageKey = "whiteboard-users-v1";
  const lastUserStorageKey = "whiteboard-last-user-v1";
  let boardTitle = boardId;
  const favoriteStorageKey = "whiteboard-favorites-v1";
  const paletteStorageKey = "whiteboard-palette-v1";
  const legacyUserStorageKey = `board-users-${boardId}`;
  const legacyLastUserStorageKey = `last-user-${boardId}`;
  const legacyFavoriteStorageKey = `favorites-${boardId}`;
  const legacyPaletteStorageKey = `palette-${boardId}`;
  const userProfileStorageKey = "user-profiles-v1";
  let favoritesByUser = loadFavorites();
  let paletteColors = loadPalette();
  let userProfiles = loadUserProfiles();

  // --- 状態 ---
  // ペン用の現在色
  let currentColor = "#000000";
  let activeColorSwatch = null;
  let currentSize = parseInt(sizeRange.value, 10);
  let currentTool = "pen"; // "pen" | "fill" | "select" | "eraser" | "lasso-copy"
  let currentUser = "";
  let knownUsers = [];
  let onlineUsers = [];
  let latestFollowView = null;
  let followViewLabel = null;
  let lastViewPresenceEmitAt = 0;
  let lastEmittedView = null;
  let viewPresenceTimer = null;
  let boardUsersFromServer = [];
  let strokesDimmed = false;
  const DIM_ALPHA = 0.35;
  let attentionActive = false;
  const attentionPointers = new Map(); // user -> {x,y,color,updatedAt}
  const writingLabels = new Map(); // socketId/user -> {user,x,y,updatedAt}
  let attentionTimeout = null;
  let attentionAnimRaf = null;
  let localWritingActive = false;
  let lastWritingLabelEmitAt = 0;
  let writingLabelCleanupTimer = null;
  let activeLayer = "user"; // "user" | "base" | "image" | "draft" | "admin"
  let lastUserLayerTool = "pen";
  let selectionDragActive = false;
  let isSelectingArea = false;
  let selectionDragStart = null;
  let selectionDragCurrent = null;
  let lassoCopyActive = false;
  let lassoCopyPath = [];
  let lassoCopyMode = "rect"; // "freehand" | "rect"
  let lassoCopySelection = null; // { mode, worldPath, worldBounds }
  const pendingImageLoadTokens = new Map();
  const imageElementCache = new Map();
  const pendingStrokeAdds = new Map();
  const pendingTextAdds = new Map();
  const pendingImageAdds = new Map();
  const pendingLinkAdds = new Map();
  let imageLoadTokenCounter = 0;
  let frameRenderCache = null;
  let redrawRafId = null;
  let staticLayerCache = null;
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
  let activeAltSide = null; // "left" | "right" | null
  let altArrowShortcutUsed = false;
  let pendingImageInsertLayer = null;
  let hiddenCommandBuffer = "";
  let localScreenStream = null;
  let localScreenShareActive = false;
  let activeScreenShareSocketId = null;
  let activeScreenShareUser = "";
  let screenShareFocus = false;
  let screenShareWindowPosition = null;
  let screenShareDrag = null;
  let suppressNextScreenShareClick = false;
  const screenSharePeers = new Map();
  const remoteScreenStreams = new Map();
  const knownScreenSharers = new Map();

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

  function getAxisAlignedBoundsFromPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // テキストの「デフォルト色＆サイズ」（最後に使った文字の色と大きさを記憶）
  let textDefaultColor = "#000000";
  let textDefaultFontSizeWorld = 16; // ホワイトボード座標系でのフォントサイズ

  // 図形データ
  const strokes = []; // { id, color, size, points: [{x,y}], user, order }
  const images = [];  // { id, img, src, x, y, width, height, layer: "base", order }
  const texts = [];   // { id, lines:[string], x, y, fontSize, color, user, order, createdAt, label }
  const links = [];   // { id, url, title, description, image, siteName, x, y, width, height, layer, order }
  const draftStrokes = []; // { id, color, size, points, user, order, createdAt }
  let textListOpen = false;
  const textListSelectedIds = new Set();
  let textListStarOnlyEnabled = false;
  let textListOrderCounter = 0;
  let imageListOpen = false;
  let linkListOpen = false;
  const listPopupWindows = new Map();
  const listPanelHomes = new Map();
  let floatingLinkBoardZ = 2200;
  let textListFloatingFrame = null;
  const openFloatingDraftBoardIds = new Set();
  let imageListOrderCounter = 0;
  const linkPreviewRefreshes = new Set();

  // ズーム・パン
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 4.0;

  // 状態フラグ
  let isDrawing = false;
  let isDrawingDraft = false;
  let activeLinkedBoardId = null;
  let isPanning = false;
  let isDraggingObject = false;
  let isResizingObject = false;
  let isErasing = false;
  let pendingTextPos = null;
  let pendingTextMode = null; // "normal" | "grid" | null
  let pendingTextListGridCopies = null;
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
  const WRITING_LABEL_TIMEOUT_MS = 8000;
  const WRITING_LABEL_END_GRACE_MS = 900;
  const TRANSPARENT_PIXEL_SRC =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const historyStack = [];
  const MAX_HISTORY = 80;
  let actionSnapshotTaken = false;
  let framePlaceType = null; // "omoteura" | "free" | null
  let framePlaceStart = null;
  let framePlacePreview = null;
  let frameCounter = 1;
  let isPlacingFrame = false;
  let linkBoardMode = null; // "source" | "place" | null
  let linkBoardSourceStart = null;
  let linkBoardSourcePreview = null;
  let pendingLinkBoardSource = null;
  let linkBoardPlaceStart = null;
  let linkBoardPlacePreview = null;
  let compactMode = false;
  let menuVisible = true;

  // 選択中オブジェクト
  // selected = { type: "image"|"text", index: number } or null
  let selected = null;
  let dragOffsetWorld = { x: 0, y: 0 };
  let frameDragOffsets = null;
  let draftBoardDragOffsets = null;
  let linkedBoardLabelDrag = null;
  let contextFrameTabTarget = null;
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

  function parseColorRgb(color) {
    const normalized = normalizeHexColor(color);
    if (normalized.startsWith("#") && normalized.length === 7) {
      const num = parseInt(normalized.slice(1), 16);
      if (Number.isNaN(num)) return null;
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
    const rgb = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgb) return null;
    return {
      r: Math.max(0, Math.min(255, Number(rgb[1]))),
      g: Math.max(0, Math.min(255, Number(rgb[2]))),
      b: Math.max(0, Math.min(255, Number(rgb[3]))),
    };
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  }

  function darkenColor(color, ratio = 0.08) {
    const rgb = parseColorRgb(color);
    if (!rgb) return color;
    return rgbToHex({
      r: rgb.r * (1 - ratio),
      g: rgb.g * (1 - ratio),
      b: rgb.b * (1 - ratio),
    });
  }

  function ensureVisibleFrameHeaderColor(bodyColor, headerColor) {
    const body = parseColorRgb(bodyColor);
    const header = parseColorRgb(headerColor);
    if (!body || !header) return headerColor;
    const delta = Math.abs(body.r - header.r) + Math.abs(body.g - header.g) + Math.abs(body.b - header.b);
    return delta < 48 ? darkenColor(headerColor, 0.1) : headerColor;
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
    const cloneLinks = (arr) => arr.map(({ _img, ...l }) => ({ ...l }));
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
        rotation: img.rotation || 0,
        mirrored: !!img.mirrored,
        tagType: img.tagType || null,
        tagLabel: img.tagLabel || "",
        imageName: img.imageName || "",
        imageListOrder: img.imageListOrder ?? null,
        frameId: img.frameId || null,
        frameTab: img.frameTab || null,
        frameTabs: img.frameTabs ? img.frameTabs.map((tab) => ({ ...tab })) : null,
        activeFrameTab: img.activeFrameTab || null,
        linkBoardSource: img.linkBoardSource ? { ...img.linkBoardSource } : null,
        draftBoardSource: img.draftBoardSource ? { ...img.draftBoardSource } : null,
        draftBoardId: img.draftBoardId || null,
        lassoToolObject: !!img.lassoToolObject,
        lassoOutlinePath: Array.isArray(img.lassoOutlinePath)
          ? img.lassoOutlinePath.map((p) => ({ x: p.x, y: p.y }))
          : null,
      }));

    return {
      strokes: cloneStrokes(strokes),
      texts: cloneTexts(texts),
      images: cloneImages(images),
      links: cloneLinks(links),
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
    pendingImageLoadTokens.clear();
    const rebuildImages = (arr = []) =>
      arr.map((img) => {
        const cached = imageElementCache.get(img.id);
        const el = cached?.src === img.src ? cached.img : null;
        return {
          ...img,
          img: el,
        };
      });

    strokes.splice(0, strokes.length, ...(snap.strokes || []));
    texts.splice(0, texts.length, ...(snap.texts || []));
    images.splice(0, images.length, ...rebuildImages(snap.images || []));
    links.splice(0, links.length, ...(snap.links || []));
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
    activeLinkedBoardId = null;
    isErasing = false;
    isDraggingObject = false;
    isResizingObject = false;
    draftBoardDragOffsets = null;
    frameDragOffsets = null;
    linkedBoardLabelDrag = null;
    shapeMode = null;
    if (textEditor) {
      endLocalWritingLabel();
      textEditor.remove();
      textEditor = null;
    }
    actionSnapshotTaken = false;
    refreshTextList();
    refreshLinkList();
    updateLayerToggleUI();
    updateToolButtons();
    redraw();
  }

  function ensureSnapshotForAction() {
    if (actionSnapshotTaken) return;
    pushSnapshot();
    actionSnapshotTaken = true;
  }

  function stableSnapshotValue(value) {
    if (Array.isArray(value)) return value.map(stableSnapshotValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value)
      .filter((key) => key !== "img")
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSnapshotValue(value[key]);
        return acc;
      }, {});
  }

  function snapshotItemChanged(beforeItem, afterItem) {
    return JSON.stringify(stableSnapshotValue(beforeItem)) !== JSON.stringify(stableSnapshotValue(afterItem));
  }

  function imageSnapshotPayload(img) {
    return {
      id: img.id,
      src: img.src,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      layer: img.layer,
      order: img.order,
      user: img.user,
      rotation: img.rotation || 0,
      mirrored: !!img.mirrored,
      tagType: img.tagType || null,
      tagLabel: img.tagLabel || "",
      imageName: img.imageName || "",
      imageListOrder:
        typeof img.imageListOrder === "number" ? img.imageListOrder : img.order || 0,
      frameId: img.frameId || null,
      frameTab: img.frameTab || null,
      frameTabs: img.frameTabs || null,
      activeFrameTab: img.activeFrameTab || null,
      linkBoardSource: img.linkBoardSource || null,
      draftBoardSource: img.draftBoardSource || null,
      draftBoardId: img.draftBoardId || null,
      lassoToolObject: !!img.lassoToolObject,
      lassoOutlinePath: Array.isArray(img.lassoOutlinePath)
        ? img.lassoOutlinePath.map((p) => ({ x: p.x, y: p.y }))
        : null,
    };
  }

  function syncUndoCollection(type, beforeItems = [], afterItems = [], options = {}) {
    if (!socketConnected) return;
    const beforeById = new Map(beforeItems.filter((item) => item?.id).map((item) => [item.id, item]));
    const afterById = new Map(afterItems.filter((item) => item?.id).map((item) => [item.id, item]));

    beforeById.forEach((_, id) => {
      if (!afterById.has(id)) {
        if (options.remove) {
          options.remove(id);
        } else {
          socket.emit("item:remove", { boardId, type, id });
        }
      }
    });

    afterById.forEach((afterItem, id) => {
      const beforeItem = beforeById.get(id);
      if (!beforeItem) {
        if (options.add) {
          options.add(afterItem);
        } else if (type === "text") {
          emitTextAdd(afterItem);
        } else if (type === "stroke") {
          emitStrokeAdd(afterItem);
        } else if (type === "image") {
          emitImageAdd(afterItem);
        }
      } else if (snapshotItemChanged(beforeItem, afterItem)) {
        if (options.update) {
          options.update(afterItem);
        } else {
          socket.emit("item:update", { boardId, type, id, patch: stableSnapshotValue(afterItem) });
        }
      }
    });
  }

  function syncRestoredSnapshot(before, after) {
    if (!socketConnected || !before || !after) return;
    syncUndoCollection("stroke", before.strokes, after.strokes);
    syncUndoCollection("text", before.texts, after.texts);
    syncUndoCollection("image", before.images, after.images);
    syncUndoCollection("link", before.links, after.links, {
      add: (link) => emitLinkAdd(link),
    });
    syncUndoCollection("draft", before.draftStrokes, after.draftStrokes, {
      add: (stroke) => socket.emit("draft:stroke:add", { boardId, stroke }),
      remove: (id) => socket.emit("draft:stroke:remove", { boardId, id }),
      update: (stroke) => socket.emit("draft:stroke:add", { boardId, stroke }),
    });
  }

  function canUndoItem(item) {
    if (!item) return false;
    return item.user ? item.user === currentUser : !currentUser;
  }

  function mergeUndoCollection(currentItems = [], snapshotItems = []) {
    const currentById = new Map(currentItems.filter((item) => item?.id).map((item) => [item.id, item]));
    const snapshotById = new Map(snapshotItems.filter((item) => item?.id).map((item) => [item.id, item]));
    const merged = [];

    snapshotItems.forEach((snapshotItem) => {
      if (!snapshotItem?.id) {
        merged.push(snapshotItem);
        return;
      }

      const currentItem = currentById.get(snapshotItem.id);
      if (currentItem && !canUndoItem(currentItem) && !canUndoItem(snapshotItem)) {
        merged.push(currentItem);
        return;
      }

      if (!currentItem && !canUndoItem(snapshotItem)) return;
      merged.push(snapshotItem);
    });

    currentItems.forEach((currentItem) => {
      if (!currentItem?.id || snapshotById.has(currentItem.id)) return;
      if (!canUndoItem(currentItem)) merged.push(currentItem);
    });

    return merged;
  }

  function maxOrderInCollections(collections) {
    return collections.reduce((max, items) => {
      (items || []).forEach((item) => {
        if (typeof item?.order === "number") max = Math.max(max, item.order);
      });
      return max;
    }, 0);
  }

  function buildUndoSnapshot(current, snapshot) {
    const merged = {
      ...snapshot,
      strokes: mergeUndoCollection(current.strokes, snapshot.strokes),
      texts: mergeUndoCollection(current.texts, snapshot.texts),
      images: mergeUndoCollection(current.images, snapshot.images),
      links: mergeUndoCollection(current.links, snapshot.links),
      draftStrokes: mergeUndoCollection(current.draftStrokes, snapshot.draftStrokes),
    };

    merged.orderCounter = Math.max(
      snapshot.orderCounter || 0,
      maxOrderInCollections([merged.strokes, merged.texts, merged.images, merged.links])
    );
    merged.draftOrderCounter = Math.max(
      snapshot.draftOrderCounter || 0,
      maxOrderInCollections([merged.draftStrokes])
    );
    return merged;
  }

  function buildTextShadow(baseColor, fontSizePx) {
    const { outer } = getTextStrokeWidths(fontSizePx);
    const blur = Math.max(1, outer * 0.7);
    return `0 0 ${blur}px #ffffff`;
  }

  function isOwnDraftBoardItem(obj) {
    return !!obj && obj.user === currentUser && !!obj.draftBoardId;
  }

  function isOwnDraftBoardOverlay(imgObj) {
    return !!imgObj && imgObj.user === currentUser && !!imgObj.draftBoardSource;
  }

  function isFloatingDraftBoardObject(obj) {
    if (!obj) return false;
    if (obj.draftBoardSource) return !!obj.draftBoardSource.floating;
    if (!obj.draftBoardId) return false;
    const board = images.find((img) => img?.id === obj.draftBoardId);
    return !!board?.draftBoardSource?.floating;
  }

  function isStrokeVisible(stroke) {
    if (draftBoardViewId) return stroke?.draftBoardId === draftBoardViewId;
    if (isFloatingDraftBoardObject(stroke)) return false;
    if (stroke?.draftBoardId && openFloatingDraftBoardIds.has(stroke.draftBoardId)) return false;
    const layer = stroke.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer !== "draft" || stroke.user === currentUser;
    if (activeLayer === "user") return layer === "user" || layer === "base" || layer === "image" || isOwnDraftBoardItem(stroke);
    if (activeLayer === "base") return layer === "base" || layer === "image";
    if (activeLayer === "image") return layer === "image";
    return false;
  }

  function isTextVisible(text) {
    if (draftBoardViewId) return text?.draftBoardId === draftBoardViewId;
    if (isFloatingDraftBoardObject(text)) return false;
    if (text?.draftBoardId && openFloatingDraftBoardIds.has(text.draftBoardId)) return false;
    const layer = text.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer !== "draft" || text.user === currentUser;
    if (activeLayer === "user") return layer === "user" || layer === "base" || isOwnDraftBoardItem(text);
    if (activeLayer === "base") return layer === "base";
    if (activeLayer === "image") return false;
    return false;
  }

  function canInteractStroke(stroke) {
    if (isOwnDraftBoardItem(stroke)) return draftBoardViewId === stroke.draftBoardId;
    const layer = stroke.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer === "draft" && stroke.user === currentUser;
    if (activeLayer === "user") return layer === "user";
    if (activeLayer === "base") return layer === "base";
    if (activeLayer === "image") return isAdminUser() && layer === "image";
    return false;
  }

  function canInteractText(text) {
    if (isOwnDraftBoardItem(text)) return draftBoardViewId === text.draftBoardId;
    const layer = text.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer === "draft" && text.user === currentUser;
    if (activeLayer === "user") return layer === "user";
    if (activeLayer === "base") return layer === "base";
    return false;
  }

  function isLinkVisible(link) {
    if (draftBoardViewId) return false;
    const layer = link.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return layer !== "draft" || link.user === currentUser;
    if (activeLayer === "user") return layer === "user" || layer === "base";
    if (activeLayer === "base") return layer === "base";
    return false;
  }

  function canInteractLink(link) {
    const layer = link.layer || "user";
    if (activeLayer === "admin") return true;
    if (activeLayer === "user") return layer === "user";
    if (activeLayer === "base") return layer === "base";
    return false;
  }

  function isImageVisible(imgObj) {
    if (draftBoardViewId) {
      return imgObj?.id === draftBoardViewId || imgObj?.draftBoardId === draftBoardViewId;
    }
    if (isFloatingDraftBoardObject(imgObj)) return false;
    if (
      openFloatingDraftBoardIds.has(imgObj?.id) ||
      (imgObj?.draftBoardId && openFloatingDraftBoardIds.has(imgObj.draftBoardId))
    ) return false;
    if (activeLayer === "admin") return true;
    if (activeLayer === "draft") return (imgObj?.layer || "user") !== "draft" || imgObj?.user === currentUser;
    if (activeLayer === "image") return (imgObj?.layer || "image") === "image";
    if (activeLayer === "base") return (imgObj?.layer || "base") === "base" || (imgObj?.layer || "image") === "image";
    if (activeLayer === "user") {
      return (
        (imgObj?.layer || "user") === "user" ||
        (imgObj?.layer || "base") === "base" ||
        (imgObj?.layer || "image") === "image" ||
        isOwnDraftBoardOverlay(imgObj) ||
        isOwnDraftBoardItem(imgObj)
      );
    }
    return false;
  }

  function canInteractImage(imgObj = null) {
    if (!imgObj) return false;
    if (draftBoardViewId && imgObj.id === draftBoardViewId) return false;
    if (isOwnDraftBoardItem(imgObj)) return draftBoardViewId === imgObj.draftBoardId;
    const index = images.findIndex((img) => img?.id === imgObj.id);
    if (index >= 0 && !isFrameMemberVisible(imgObj, { type: "image", index })) return false;
    if (imgObj.frameId && imgObj.frameTab === "background") {
      const frame = getFrameById(imgObj.frameId);
      if (frame && frame.activeFrameTab !== "background") return false;
    }
    if (isFrameContainer(imgObj) || isOmoteUraTagImage(imgObj)) return isImageVisible(imgObj);
    if (isOwnDraftBoardItem(imgObj)) return false;
    if (activeLayer === "admin") return true;
    const layer = imgObj.layer || "user";
    if (activeLayer === "draft") return layer === "draft" && imgObj.user === currentUser;
    if (activeLayer === "user") return layer === "user" || isOwnDraftBoardOverlay(imgObj);
    if (activeLayer === "base") return layer === "base";
    if (activeLayer === "image") return layer === "image";
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

  function isCreationLockedLayer() {
    return activeLayer === "image" || (activeLayer === "base" && !isAdminUser());
  }

  function isBaseCreationLocked() {
    return activeLayer === "base" && !isAdminUser();
  }

  function isBackgroundCreationLocked() {
    return activeLayer === "image";
  }

  function showCreationLockedMessage() {
    const layerName = isBackgroundCreationLocked() ? "背景レイヤー" : "ベースレイヤー";
    const subject = isBackgroundCreationLocked() ? "このレイヤー" : "一般ユーザー";
    showTransientFooterMessage(
      `${layerName}では、${subject}は移動・編集・削除のみできます。新規作成は通常レイヤーで行ってください。`,
      5000
    );
  }

  function stopCreationLockedLayerModes() {
    if (!isCreationLockedLayer()) return;
    if (currentTool !== "select" && currentTool !== "eraser") {
      currentTool = "select";
    }
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    shapeMode = null;
    shapeStart = null;
    shapePreview = null;
    shapeTargetLayer = null;
    framePlaceType = null;
    framePlaceStart = null;
    framePlacePreview = null;
    lassoCopyActive = false;
    lassoCopyPath = [];
    lassoCopySelection = null;
    linkBoardMode = null;
    linkBoardSourceStart = null;
    linkBoardSourcePreview = null;
    pendingLinkBoardSource = null;
    linkBoardPlaceStart = null;
    linkBoardPlacePreview = null;
    isDrawingShape = false;
    isPlacingFrame = false;
    isDrawing = false;
    activeStrokeId = null;
    closeInsertMenu();
  }

  function canCreateOnCurrentLayer() {
    if (!isCreationLockedLayer()) return true;
    stopCreationLockedLayerModes();
    updateToolButtons();
    showCreationLockedMessage();
    return false;
  }

  function updateLayerToggleUI() {
    const hasBtn = !!layerToggleBtn;
    const isImage = activeLayer === "image";
    const isAdmin = activeLayer === "admin";
    const labelText = (() => {
      if (isAdmin) return "Admin";
      if (isImage) return "背景(共用)";
      if (activeLayer === "base") return "ベース(共用)";
      if (activeLayer === "draft") return "下書き";
      return layerUserLabel();
    })();
    if (hasBtn) {
      if (isAdmin) {
        layerToggleBtn.textContent = "レイヤー: Admin";
      } else if (isImage) {
        layerToggleBtn.textContent = "レイヤー: 背景(共用)";
      } else if (activeLayer === "base") {
        layerToggleBtn.textContent = "レイヤー: ベースレイヤー(共用)";
      } else if (activeLayer === "draft") {
        layerToggleBtn.textContent = "レイヤー: 下書き";
      } else {
        layerToggleBtn.textContent = `レイヤー: ${layerUserLabel()}`;
      }
      layerToggleBtn.title = isAdminUser()
        ? "クリックでレイヤー切り替え"
        : "クリックで通常/下書き切り替え。Ctrl+クリックで共有レイヤー表示";
      layerToggleBtn.classList.toggle("is-image", isImage && !isAdmin);
    }
    if (layerDisplay) {
      layerDisplay.textContent = `Layer: ${labelText}`;
    }
  }

  function setActiveLayer(layer, opts = {}) {
    if (layer !== "user" && layer !== "base" && layer !== "image" && layer !== "admin" && layer !== "draft") return;
    if (activeLayer === layer) return;
    const allowSharedView = !!opts.allowSharedView;
    if (!isAdminUser() && (layer === "admin" || (layer === "image" && !allowSharedView))) {
      showTransientFooterMessage("背景/Adminレイヤーは Admin のみ使用できます。", 4000);
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
      linkedBoardLabelDrag = null;
      selected = null;
      multiSelection = null;
      lassoCopySelection = null;
      pendingTextListGridCopies = null;
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
      linkedBoardLabelDrag = null;
      selected = null;
      multiSelection = null;
      lassoCopySelection = null;
      pendingTextListGridCopies = null;
      pendingTextPos = null;
      selectionDragActive = false;
      isSelectingArea = false;
      updateToolButtons();
    }

    activeLayer = layer;
    stopCreationLockedLayerModes();
    updateLayerToggleUI();
    updateToolButtons();
    const layerHints = {
      user: "通常レイヤー：描いたものは全員に見えます。",
      base: isAdminUser()
        ? "ベースレイヤー(共用)：背景として共有されます。"
        : "ベースレイヤー(共用)：一般ユーザーは移動・編集・削除のみできます。",
      image: "背景レイヤー：背景画像のみ操作できます。",
      draft: "下書きレイヤー：自分にだけ見えます。",
      admin: "Admin：全レイヤーを操作できます。",
    };
    const hint = layerHints[layer] || "";
    if (hint) showTransientFooterMessage(hint, 6000);
    redraw();
  }

  function toggleHiddenSharedLayer() {
    if (!isAdminUser()) {
      const nextLayer =
        activeLayer === "user" ? "base" : activeLayer === "base" ? "image" : "user";
      setActiveLayer(nextLayer, { allowSharedView: true });
      return;
    }
    const nextLayer = activeLayer === "base" ? "image" : activeLayer === "image" ? "user" : "base";
    setActiveLayer(nextLayer);
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
      // Admin 以外の通常切り替えは「通常」と「下書き」のみ
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

  function bumpTextListOrderCounter(orderValue) {
    if (typeof orderValue === "number") {
      textListOrderCounter = Math.max(textListOrderCounter, orderValue);
    } else {
      textListOrderCounter += 1;
    }
    return textListOrderCounter;
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
    if (followTargetUser && latestFollowView) {
      applyFollowView(latestFollowView);
      return;
    }
    if (linkBoardView) {
      applyLinkBoardView();
      return;
    }
    if (draftBoardViewId && applyDraftBoardView()) return;
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
      if (stroke) emitStrokeAdd(stroke);
    }
    endLocalWritingLabel();
    isDrawing = false;
    isDrawingDraft = false;
    activeStrokeId = null;
    activeDraftId = null;
    activeLinkedBoardId = null;
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
  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadStoredUsers() {
    const globalUsers = readJsonStorage(userStorageKey, []);
    const legacyUsers = readJsonStorage(legacyUserStorageKey, []);
    const merged = [];
    [...(Array.isArray(globalUsers) ? globalUsers : []), ...(Array.isArray(legacyUsers) ? legacyUsers : [])].forEach((name) => {
      if (typeof name === "string" && name && !merged.includes(name)) merged.push(name);
    });
    if (JSON.stringify(merged) !== JSON.stringify(Array.isArray(globalUsers) ? globalUsers : [])) {
      saveStoredUsers(merged);
    }
    return merged;
  }

  function loadFavorites() {
    const globalFavs = readJsonStorage(favoriteStorageKey, {});
    const legacyFavs = readJsonStorage(legacyFavoriteStorageKey, {});
    const merged = {
      ...(legacyFavs && typeof legacyFavs === "object" && !Array.isArray(legacyFavs) ? legacyFavs : {}),
      ...(globalFavs && typeof globalFavs === "object" && !Array.isArray(globalFavs) ? globalFavs : {}),
    };
    const normalizedGlobal = globalFavs && typeof globalFavs === "object" && !Array.isArray(globalFavs) ? globalFavs : {};
    if (JSON.stringify(merged) !== JSON.stringify(normalizedGlobal)) {
      try {
        localStorage.setItem(favoriteStorageKey, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    return merged;
  }

  function loadPalette() {
    const globalPalette = readJsonStorage(paletteStorageKey, null);
    const legacyPalette = readJsonStorage(legacyPaletteStorageKey, null);
    const source = Array.isArray(globalPalette) ? globalPalette : legacyPalette;
    const palette = Array.isArray(source) ? source.filter((c) => typeof c === "string") : [];
    if (palette.length && !Array.isArray(globalPalette)) {
      try {
        localStorage.setItem(paletteStorageKey, JSON.stringify(palette));
      } catch {
        // ignore
      }
    }
    return palette;
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
    if (!name) return;
    userProfiles = userProfiles || {};
    const prev = userProfiles[name] || {};
    if (color) {
      userProfiles[name] = { ...prev, favoriteColor: color };
    } else if (Object.keys(prev).length) {
      const next = { ...prev };
      delete next.favoriteColor;
      userProfiles[name] = next;
    }
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
      const globalUser = localStorage.getItem(lastUserStorageKey) || "";
      if (globalUser) return globalUser;
      const legacyUser = localStorage.getItem(legacyLastUserStorageKey) || "";
      if (legacyUser) saveLastUser(legacyUser);
      return legacyUser;
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

  function getCurrentRegisteredFavoriteColor() {
    return currentUser ? favoritesByUser[currentUser] || getProfileFavoriteColor(currentUser) || "" : "";
  }

  function getUserRegisteredFavoriteColor(userName) {
    return userName ? favoritesByUser[userName] || getProfileFavoriteColor(userName) || "" : "";
  }

  function getStrokeGlowColor(stroke) {
    return stroke?.glowColor || getUserRegisteredFavoriteColor(stroke?.user) || "";
  }

  function applyCurrentGlowColor(target) {
    const glowColor = getCurrentRegisteredFavoriteColor();
    if (target && glowColor) target.glowColor = glowColor;
    return target;
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
      return createOmoteUraFrameTag(w, h, label === "horizontal" ? "horizontal" : "vertical");
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
            body: colors?.body || lightenColor(currentColor, 0.9),
            header: colors?.header || lightenColor(currentColor, 0.8),
            text: label || "フレーム",
            textColor: colors?.text || "#1c1c1c",
          };
    const headerH = Math.min(Math.max(34, h * 0.28), 56);
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
      omoteBody: "#fff3f1",
      omoteBar: "#f8b4ad",
      uraBody: "#eef7ff",
      uraBar: "#a8d8f5",
      border: "#d5cbd2",
      text: "#5f5360",
    };
  }

  function createOmoteUraFrameTag(width, height, orientation = "vertical") {
    const w = Math.max(120, Math.abs(width));
    const h = Math.max(80, Math.abs(height));
    const colors = getOmoteUraFrameColors();
    const barW = Math.min(28, Math.max(18, w * 0.1));
    const isHorizontal = orientation === "horizontal";
    const midY = h / 2;
    const midX = w / 2;
    const canvasTag = document.createElement("canvas");
    canvasTag.width = w;
    canvasTag.height = h;
    const c = canvasTag.getContext("2d");

    if (isHorizontal) {
      c.fillStyle = colors.omoteBody;
      c.fillRect(0, 0, midX, h);
      c.fillStyle = colors.uraBody;
      c.fillRect(midX, 0, w - midX, h);
      c.fillStyle = colors.omoteBar;
      c.fillRect(0, 0, midX, barW);
      c.fillStyle = colors.uraBar;
      c.fillRect(midX, 0, w - midX, barW);
    } else {
      c.fillStyle = colors.omoteBody;
      c.fillRect(0, 0, w, midY);
      c.fillStyle = colors.uraBody;
      c.fillRect(0, midY, w, h - midY);
      c.fillStyle = colors.omoteBar;
      c.fillRect(0, 0, barW, midY);
      c.fillStyle = colors.uraBar;
      c.fillRect(0, midY, barW, h - midY);
    }
    c.strokeStyle = colors.border;
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);

    c.fillStyle = colors.text;
    c.font = "18px sans-serif";
    c.textBaseline = "middle";
    c.textAlign = "center";
    if (isHorizontal) {
      c.fillText("表", midX / 2, barW / 2);
      c.fillText("裏", midX + (w - midX) / 2, barW / 2);
    } else {
      c.fillText("表", barW / 2, midY / 2);
      c.fillText("裏", barW / 2, midY + (h - midY) / 2);
    }
    return canvasTag.toDataURL("image/png");
  }

  function getFrameHeaderHeightWorld(imgObj) {
    const worldH = Math.max(1, Math.abs(imgObj?.height || 0));
    return Math.min(Math.max(34, worldH * 0.28), 56);
  }

  function getFrameTotalHeightForViewportHeight(viewportHeight) {
    const bodyH = Math.max(1, Math.abs(viewportHeight || 0));
    let totalH = bodyH + getFrameHeaderHeightWorld({ height: bodyH });
    for (let i = 0; i < 4; i += 1) {
      totalH = bodyH + getFrameHeaderHeightWorld({ height: totalH });
    }
    return totalH;
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
            body: lightenColor(currentColor, 0.9),
            header: lightenColor(currentColor, 0.8),
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
      const sourceHeaderH = Math.min(Math.max(34, imgEl.naturalHeight * 0.28), 56);
      const toRgb = (data) => `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
      const toHex = (data) =>
        `#${[data[0], data[1], data[2]]
          .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
          .join("")}`;
      const header = sampleCtx.getImageData(1, 1, 1, 1).data;
      const bodyY = Math.min(imgEl.naturalHeight - 1, Math.ceil(sourceHeaderH) + 1);
      const body = sampleCtx.getImageData(1, bodyY, 1, 1).data;
      const sampledBody = toRgb(body);
      const sampledHeader = toRgb(header);
      const sampledBodyHex = toHex(body);
      const sampledHeaderHex = toHex(header);
      imgObj.tagColors =
        imgObj?.tagType === "free"
          ? {
              ...fallback,
              body: lightenColor(sampledBodyHex, 0.6),
              header: lightenColor(sampledHeaderHex, 0.6),
            }
          : { ...fallback, body: sampledBody, header: sampledHeader };
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
    const headerColor = ensureVisibleFrameHeaderColor(colors.body, colors.header);
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
    const { radius } = drawModernFrameBase(ctx, worldW, worldH, colors.body, headerColor);
    ctx.save();
    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    ctx.clip();
    const headerGradient = ctx.createLinearGradient(0, 0, 0, headerH);
    headerGradient.addColorStop(0, lightenColor(headerColor, 0.2));
    headerGradient.addColorStop(1, headerColor);
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, worldW, headerH);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillRect(0, 0, worldW, Math.max(1, headerH * 0.18));
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.fillRect(0, Math.max(0, headerH - 1), worldW, 1);
    ctx.restore();
    ctx.fillStyle = colors.text;
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    drawFrameTabs(ctx, imgObj, worldW, headerH);
    if (worldW > 210) {
      drawFittedText(ctx, label, Math.max(150, worldW * 0.55), headerH / 2, Math.max(0, worldW * 0.4));
    }
    ctx.restore();
  }

  function drawFrameHeaderOverlay(ctx, imgObj) {
    if (!imgObj?.tagType || imgObj.tagType === "omoteura") return;
    const colors = getFrameTagColors(imgObj);
    const headerColor = ensureVisibleFrameHeaderColor(colors.body, colors.header);
    const worldW = imgObj.width;
    const worldH = imgObj.height;
    const headerH = Math.min(getFrameHeaderHeightWorld(imgObj), worldH);
    const label =
      imgObj.tagLabel || (imgObj.tagType === "omote" ? "表" : imgObj.tagType === "ura" ? "裏" : "フレーム");
    const rotation = normalizeRotation(imgObj.rotation || 0);

    ctx.save();
    const screenPos = worldToScreen(imgObj.x, imgObj.y);
    ctx.translate(screenPos.x, screenPos.y);
    ctx.scale(scale, scale);
    if (rotation) {
      ctx.translate(worldW / 2, worldH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-worldW / 2, -worldH / 2);
    }
    const radius = Math.min(10, Math.max(4, Math.min(worldW, worldH) * 0.04));
    ctx.save();
    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    ctx.clip();
    const headerGradient = ctx.createLinearGradient(0, 0, 0, headerH);
    headerGradient.addColorStop(0, lightenColor(headerColor, 0.2));
    headerGradient.addColorStop(1, headerColor);
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, worldW, headerH);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillRect(0, 0, worldW, Math.max(1, headerH * 0.18));
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.fillRect(0, Math.max(0, headerH - 1), worldW, 1);
    ctx.restore();
    ctx.fillStyle = colors.text;
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    drawFrameTabs(ctx, imgObj, worldW, headerH);
    if (worldW > 210) {
      drawFittedText(ctx, label, Math.max(150, worldW * 0.55), headerH / 2, Math.max(0, worldW * 0.4));
    }
    ctx.restore();
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawModernFrameBase(ctx, worldW, worldH, bodyColor, headerColor) {
    const radius = Math.min(10, Math.max(4, Math.min(worldW, worldH) * 0.04));
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
    ctx.shadowBlur = Math.max(4, Math.min(16, Math.min(worldW, worldH) * 0.05));
    ctx.shadowOffsetY = Math.max(2, Math.min(8, worldH * 0.025));
    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.restore();

    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    const bodyGradient = ctx.createLinearGradient(0, 0, 0, worldH);
    bodyGradient.addColorStop(0, lightenColor(bodyColor, 0.34));
    bodyGradient.addColorStop(0.55, bodyColor);
    bodyGradient.addColorStop(1, lightenColor(bodyColor, 0.12));
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    ctx.save();
    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    ctx.clip();
    const shine = ctx.createLinearGradient(0, 0, worldW, worldH);
    shine.addColorStop(0, "rgba(255,255,255,0.34)");
    shine.addColorStop(0.34, "rgba(255,255,255,0.08)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, worldW, worldH);
    ctx.restore();

    const border = ctx.createLinearGradient(0, 0, 0, worldH);
    border.addColorStop(0, "rgba(255,255,255,0.72)");
    border.addColorStop(1, "rgba(15,23,42,0.3)");
    roundedRectPath(ctx, 0.5, 0.5, Math.max(0, worldW - 1), Math.max(0, worldH - 1), radius);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    return { radius, headerColor };
  }

  function drawOmoteUraFrameImage(ctx, imgObj, rotation) {
    const colors = getOmoteUraFrameColors();
    const worldW = imgObj.width;
    const worldH = imgObj.height;
    const barW = Math.min(28, Math.max(18, worldW * 0.1));
    const isHorizontal = getOmoteUraOrientation(imgObj) === "horizontal";
    const midY = worldH / 2;
    const midX = worldW / 2;

    ctx.save();
    const screenPos = worldToScreen(imgObj.x, imgObj.y);
    ctx.translate(screenPos.x, screenPos.y);
    ctx.scale(scale, scale);
    if (rotation) {
      ctx.translate(worldW / 2, worldH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-worldW / 2, -worldH / 2);
    }

    const { radius } = drawModernFrameBase(ctx, worldW, worldH, colors.uraBody, colors.uraBar);
    ctx.save();
    roundedRectPath(ctx, 0, 0, worldW, worldH, radius);
    ctx.clip();

    if (isHorizontal) {
      const omoteGradient = ctx.createLinearGradient(0, 0, midX, worldH);
      omoteGradient.addColorStop(0, lightenColor(colors.omoteBody, 0.3));
      omoteGradient.addColorStop(1, colors.omoteBody);
      ctx.fillStyle = omoteGradient;
      ctx.fillRect(0, 0, midX, worldH);

      const uraGradient = ctx.createLinearGradient(midX, 0, worldW, worldH);
      uraGradient.addColorStop(0, lightenColor(colors.uraBody, 0.28));
      uraGradient.addColorStop(1, colors.uraBody);
      ctx.fillStyle = uraGradient;
      ctx.fillRect(midX, 0, worldW - midX, worldH);

      const omoteBarGradient = ctx.createLinearGradient(0, 0, 0, barW);
      omoteBarGradient.addColorStop(0, lightenColor(colors.omoteBar, 0.18));
      omoteBarGradient.addColorStop(1, colors.omoteBar);
      ctx.fillStyle = omoteBarGradient;
      ctx.fillRect(0, 0, midX, barW);

      const uraBarGradient = ctx.createLinearGradient(midX, 0, midX, barW);
      uraBarGradient.addColorStop(0, lightenColor(colors.uraBar, 0.18));
      uraBarGradient.addColorStop(1, colors.uraBar);
      ctx.fillStyle = uraBarGradient;
      ctx.fillRect(midX, 0, worldW - midX, barW);
    } else {
      const omoteGradient = ctx.createLinearGradient(0, 0, worldW, midY);
      omoteGradient.addColorStop(0, lightenColor(colors.omoteBody, 0.3));
      omoteGradient.addColorStop(1, colors.omoteBody);
      ctx.fillStyle = omoteGradient;
      ctx.fillRect(0, 0, worldW, midY);

      const uraGradient = ctx.createLinearGradient(0, midY, worldW, worldH);
      uraGradient.addColorStop(0, lightenColor(colors.uraBody, 0.28));
      uraGradient.addColorStop(1, colors.uraBody);
      ctx.fillStyle = uraGradient;
      ctx.fillRect(0, midY, worldW, worldH - midY);

      const omoteBarGradient = ctx.createLinearGradient(0, 0, barW, 0);
      omoteBarGradient.addColorStop(0, lightenColor(colors.omoteBar, 0.18));
      omoteBarGradient.addColorStop(1, colors.omoteBar);
      ctx.fillStyle = omoteBarGradient;
      ctx.fillRect(0, 0, barW, midY);

      const uraBarGradient = ctx.createLinearGradient(0, midY, barW, midY);
      uraBarGradient.addColorStop(0, lightenColor(colors.uraBar, 0.18));
      uraBarGradient.addColorStop(1, colors.uraBar);
      ctx.fillStyle = uraBarGradient;
      ctx.fillRect(0, midY, barW, worldH - midY);
    }

    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillRect(0, 0, worldW, Math.max(1, worldH * 0.035));
    ctx.strokeStyle = "rgba(15,23,42,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isHorizontal) {
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, worldH);
    } else {
      ctx.moveTo(0, midY);
      ctx.lineTo(worldW, midY);
    }
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = colors.text;
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    if (isHorizontal) {
      ctx.fillText("表", midX / 2, barW / 2);
      ctx.fillText("裏", midX + (worldW - midX) / 2, barW / 2);
    } else {
      ctx.fillText("表", barW / 2, midY / 2);
      ctx.fillText("裏", barW / 2, midY + (worldH - midY) / 2);
    }
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

  function drawCenteredFittedText(ctx, text, x, y, maxWidth) {
    const previousAlign = ctx.textAlign;
    ctx.textAlign = "center";
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) {
      ctx.fillText(value, x, y);
      ctx.textAlign = previousAlign;
      return;
    }

    const ellipsis = "...";
    let fitted = value;
    while (fitted.length > 0 && ctx.measureText(`${fitted}${ellipsis}`).width > maxWidth) {
      fitted = fitted.slice(0, -1);
    }
    ctx.fillText(fitted ? `${fitted}${ellipsis}` : ellipsis, x, y);
    ctx.textAlign = previousAlign;
  }

  function getFrameHeaderBoundsWorld(imgObj) {
    if (!isFrameContainer(imgObj)) return null;
    return {
      x: imgObj.x,
      y: imgObj.y,
      width: imgObj.width,
      height: Math.min(imgObj.height, getFrameHeaderHeightWorld(imgObj)),
    };
  }

  function getFrameHeaderHitBoundsScreen(imgObj, minHitHeight = 28) {
    const header = getFrameHeaderBoundsWorld(imgObj);
    if (!header) return null;
    const screenHeader = {
      x: header.x * scale + offsetX,
      y: header.y * scale + offsetY,
      width: header.width * scale,
      height: header.height * scale,
    };
    return {
      x: screenHeader.x,
      y: screenHeader.y - Math.max(0, minHitHeight - screenHeader.height) / 2,
      width: screenHeader.width,
      height: Math.max(screenHeader.height, minHitHeight),
    };
  }

  function ensureFrameTabs(frameImg) {
    if (!isFrameContainer(frameImg)) return [];
    if (!Array.isArray(frameImg.frameTabs) || frameImg.frameTabs.length === 0) {
      frameImg.frameTabs = [{ id: "tab-1", name: "1" }];
    }
    if (
      !frameImg.activeFrameTab ||
      (frameImg.activeFrameTab !== "background" && !frameImg.frameTabs.some((tab) => tab.id === frameImg.activeFrameTab))
    ) {
      frameImg.activeFrameTab = frameImg.frameTabs[0].id;
    }
    return frameImg.frameTabs;
  }

  function getFrameActiveTab(frameImg) {
    const tabs = ensureFrameTabs(frameImg);
    return frameImg?.activeFrameTab || tabs[0]?.id || "tab-1";
  }

  function getFrameCurrentTargetTab(frameImg) {
    if (!isFrameContainer(frameImg)) return null;
    return frameImg.activeFrameTab === "background" ? "background" : getFrameActiveTab(frameImg);
  }

  function getFrameTabLabelSourceId(frameImg, tabId) {
    if (!frameImg?.id || !tabId) return null;
    return `${frameImg.id}:${tabId}`;
  }

  function getFrameTabDisplayName(frameImg, tabId = getFrameCurrentTargetTab(frameImg)) {
    if (!isFrameContainer(frameImg) || !tabId) return "";
    if (tabId === "background") return "背景";
    const tabs = ensureFrameTabs(frameImg);
    const tab = tabs.find((item) => item.id === tabId);
    return String(tab?.name || "").trim();
  }

  function getFrameTabWidth(label) {
    const text = String(label || "");
    return Math.max(28, Math.min(108, 22 + text.length * 9));
  }

  function isFrameTabLabelTruncated(label, width) {
    const text = String(label || "");
    if (!text) return false;
    ctx.save();
    ctx.font = "12px sans-serif";
    const truncated = ctx.measureText(text).width > Math.max(0, width - 8);
    ctx.restore();
    return truncated;
  }

  function getFrameTabAtWorldPoint(frameImg, worldPoint) {
    if (!isFrameContainer(frameImg) || !worldPoint) return null;
    const header = getFrameHeaderBoundsWorld(frameImg);
    if (!header || !pointInRectWorld(header, worldPoint)) return null;
    const tabs = ensureFrameTabs(frameImg);
    const headerH = header.height;
    const tabH = Math.max(16, Math.min(26, headerH * 0.7));
    const tabY = header.y + (headerH - tabH) / 2;
    const gap = 4;
    let x = header.x + Math.min(10, header.width * 0.04);
    const bgW = 42;
    const addHit = { action: "background", x, y: tabY, width: bgW, height: tabH };
    if (pointInRectWorld(addHit, worldPoint)) return addHit;
    x += bgW + gap;
    for (const tab of tabs) {
      const label = tab.name || "?";
      const w = getFrameTabWidth(label);
      const hit = {
        action: "tab",
        tabId: tab.id,
        label,
        truncated: isFrameTabLabelTruncated(label, w),
        x,
        y: tabY,
        width: w,
        height: tabH,
      };
      if (pointInRectWorld(hit, worldPoint)) return hit;
      x += w + gap;
    }
    const plus = { action: "add", x, y: tabY, width: 26, height: tabH };
    if (pointInRectWorld(plus, worldPoint)) return plus;
    return null;
  }

  function drawFrameTabs(ctx, frameImg, worldW, headerH) {
    const tabs = ensureFrameTabs(frameImg);
    const active = getFrameActiveTab(frameImg);
    const tabH = Math.max(16, Math.min(26, headerH * 0.7));
    const tabY = (headerH - tabH) / 2;
    const gap = 4;
    let x = Math.min(10, worldW * 0.04);
    const drawTab = (label, w, selected) => {
      roundedRectPath(ctx, x, tabY, w, tabH, Math.min(7, tabH / 2));
      ctx.fillStyle = selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.42)";
      ctx.fill();
      ctx.strokeStyle = selected ? "rgba(15,23,42,0.24)" : "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = selected ? "#17232b" : "rgba(23,35,43,0.72)";
      ctx.font = "12px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      drawCenteredFittedText(ctx, label, x + w / 2, tabY + tabH / 2, Math.max(0, w - 8));
      x += w + gap;
    };
    drawTab("背景", 42, frameImg.activeFrameTab === "background");
    tabs.forEach((tab) => {
      const label = tab.name || "?";
      drawTab(label, getFrameTabWidth(label), active === tab.id);
    });
    drawTab("+", 26, false);
  }

  function canEditFrameLabel(imgObj) {
    if (!imgObj?.tagType) return false;
    if (imgObj.tagType === "omoteura") return false;
    return isImageVisible(imgObj);
  }

  function hitTestFrameLabel(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canEditFrameLabel(imgObj)) continue;
      const headerHit = getFrameHeaderHitBoundsScreen(imgObj);
      if (pointInScreenRect({ x: screenX, y: screenY }, headerHit)) return i;
      const header = getFrameHeaderBoundsWorld(imgObj);
      if (!header) continue;
      if (pointInRotatedRectWorld(worldPoint, header, imgObj.rotation || 0)) return i;
    }
    return -1;
  }

  function hitTestFrameTabControl(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!isFrameContainer(imgObj) || !isImageVisible(imgObj)) continue;
      const headerHit = getFrameHeaderHitBoundsScreen(imgObj);
      if (!pointInScreenRect({ x: screenX, y: screenY }, headerHit)) continue;
      const hit = getFrameTabAtWorldPoint(imgObj, worldPoint);
      if (!hit) return { index: i, frame: imgObj, action: "header" };
      if (hit) return { index: i, frame: imgObj, ...hit };
    }
    return null;
  }

  function hideFrameTabTooltip() {
    frameTabTooltipEl.classList.add("hidden");
    frameTabTooltipEl.textContent = "";
  }

  function updateFrameTabTooltip(canvasPos, clientX, clientY) {
    if (
      typeof clientX !== "number" ||
      typeof clientY !== "number" ||
      isDraggingObject ||
      isResizingObject ||
      isDrawing ||
      isDrawingShape ||
      isPlacingFrame ||
      isPanning ||
      isSelectingArea
    ) {
      hideFrameTabTooltip();
      return;
    }
    const hit = hitTestFrameTabControl(canvasPos.x, canvasPos.y);
    if (!hit || hit.action !== "tab" || !hit.truncated || !hit.label) {
      hideFrameTabTooltip();
      return;
    }
    frameTabTooltipEl.textContent = hit.label;
    frameTabTooltipEl.style.left = `${clientX + 12}px`;
    frameTabTooltipEl.style.top = `${clientY + 14}px`;
    frameTabTooltipEl.classList.remove("hidden");
  }

  function activateFrameTab(frameImg, tabId) {
    if (!isFrameContainer(frameImg)) return;
    ensureFrameTabs(frameImg);
    frameImg.activeFrameTab = tabId === "background" ? "background" : tabId;
    emitItemPatch("image", frameImg, { activeFrameTab: frameImg.activeFrameTab });
    redraw();
  }

  function addFrameTab(frameImg) {
    if (!isFrameContainer(frameImg)) return;
    const tabs = ensureFrameTabs(frameImg);
    const nextNum = tabs.length + 1;
    const tab = { id: `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: String(nextNum) };
    tabs.push(tab);
    frameImg.activeFrameTab = tab.id;
    emitItemPatch("image", frameImg, {
      frameTabs: frameImg.frameTabs,
      activeFrameTab: frameImg.activeFrameTab,
    });
    redraw();
  }

  function getObjectForSelectionItem(item) {
    if (!item) return null;
    if (item.type === "stroke") return strokes[item.index] || null;
    if (item.type === "draft") return draftStrokes[item.index] || null;
    if (item.type === "text") return texts[item.index] || null;
    if (item.type === "image") return images[item.index] || null;
    return null;
  }

  function getFrameTabContentItems(frameImg, tabId) {
    if (!isFrameContainer(frameImg) || !tabId || tabId === "background") return [];
    return getFrameContentItems(frameImg).filter((item) => {
      const obj = getObjectForSelectionItem(item);
      return obj?.frameId === frameImg.id && obj.frameTab === tabId;
    });
  }

  function addItemsToDeleteSets(items, strokeIds, textIds, imageIds, draftIds) {
    (items || []).forEach((item) => {
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (st && canDeleteStroke(st)) strokeIds.add(st.id);
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t && canDeleteText(t)) textIds.add(t.id);
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img && canInteractImage(img)) {
          if (isDraftBoardImage(img)) addDraftBoardContentsToDeleteSets(img, strokeIds, textIds, imageIds, draftIds);
          if (isFrameContainer(img)) addFrameContentsToDeleteSets(img, strokeIds, textIds, imageIds, draftIds);
          imageIds.add(img.id);
        }
      } else if (item.type === "draft") {
        const d = draftStrokes[item.index];
        if (d && canDeleteDraft(d)) draftIds.add(d.id);
      }
    });
  }

  function removeItemsByDeleteSets(strokeIds, textIds, imageIds, draftIds) {
    strokeIds.forEach((id) => {
      const idx = findIndexById(strokes, id);
      if (idx >= 0 && canDeleteStroke(strokes[idx])) {
        strokes.splice(idx, 1);
        if (socketConnected) socket.emit("item:remove", { boardId, type: "stroke", id });
      }
    });
    textIds.forEach((id) => {
      const idx = findIndexById(texts, id);
      if (idx >= 0 && canDeleteText(texts[idx])) {
        texts.splice(idx, 1);
        if (socketConnected) socket.emit("item:remove", { boardId, type: "text", id });
      }
    });
    imageIds.forEach((id) => {
      const idx = findIndexById(images, id);
      if (idx >= 0) {
        const removed = images.splice(idx, 1)[0];
        invalidatePendingImageLoad(removed?.id);
        if (removed && socketConnected) socket.emit("item:remove", { boardId, type: "image", id });
      } else {
        invalidatePendingImageLoad(id);
      }
    });
    draftIds.forEach((id) => {
      const idx = findIndexById(draftStrokes, id);
      if (idx >= 0 && canDeleteDraft(draftStrokes[idx])) {
        draftStrokes.splice(idx, 1);
        if (socketConnected) socket.emit("draft:stroke:remove", { boardId, id });
      }
    });
  }

  function deleteFrameTab(frameImg, tabId) {
    if (!isFrameContainer(frameImg) || !tabId || tabId === "background") return false;
    const tabs = ensureFrameTabs(frameImg);
    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0) return false;
    if (tabs.length <= 1) {
      showTransientFooterMessage("最後のタブは削除できません。", 2500);
      return true;
    }

    const tabName = tabs[tabIndex].name || String(tabIndex + 1);
    const contents = getFrameTabContentItems(frameImg, tabId);
    const message =
      contents.length > 0
        ? `タブ「${tabName}」と中のオブジェクトを削除しますか。`
        : `タブ「${tabName}」を削除しますか。`;
    if (!window.confirm(message)) return true;

    ensureSnapshotForAction();
    const strokeIds = new Set();
    const textIds = new Set();
    const imageIds = new Set();
    const draftIds = new Set();
    addItemsToDeleteSets(contents, strokeIds, textIds, imageIds, draftIds);

    tabs.splice(tabIndex, 1);
    if (frameImg.activeFrameTab === tabId) {
      frameImg.activeFrameTab = tabs[Math.min(tabIndex, tabs.length - 1)]?.id || "background";
    }
    emitItemPatch("image", frameImg, {
      frameTabs: frameImg.frameTabs,
      activeFrameTab: frameImg.activeFrameTab,
    });
    removeItemsByDeleteSets(strokeIds, textIds, imageIds, draftIds);
    if (textIds.size) refreshTextList();
    if (imageIds.size) refreshImageList();
    selected = { type: "image", index: images.findIndex((img) => img?.id === frameImg.id) };
    multiSelection = null;
    redraw();
    return true;
  }

  function estimateFrameHeaderHeightForImage(imgObj) {
    let headerH = getFrameHeaderHeightWorld(imgObj);
    for (let i = 0; i < 3; i += 1) {
      headerH = getFrameHeaderHeightWorld({ height: Math.max(1, Math.abs(imgObj.height || 0)) + headerH });
    }
    return headerH;
  }

  function createTabbedFrameFromImageIndex(imageIndex) {
    const sourceImg = images[imageIndex];
    if (!sourceImg || isFrameContainer(sourceImg)) return false;
    ensureSnapshotForAction();

    const visualBounds = getRotatedImageVisualBoundsWorld(sourceImg) || getImageBoundsWorld(sourceImg);
    if (!visualBounds) return false;
    const headerH = estimateFrameHeaderHeightForImage({
      ...sourceImg,
      height: visualBounds.height,
    });
    const frameWidth = Math.max(80, Math.abs(visualBounds.width || 0));
    const frameHeight = Math.max(80, Math.abs(visualBounds.height || 0) + headerH);
    const label = sourceImg.imageName || "フレーム";
    const dataUrl = createFrameTag("free", frameWidth * scale, frameHeight * scale, label);
    const frameImgEl = new Image();

    frameImgEl.onload = () => {
      const normalizedPatch = normalizeImageAsFrameBackground(sourceImg, visualBounds);
      const frameObj = {
        id: genId(),
        img: frameImgEl,
        src: dataUrl,
        x: visualBounds.x,
        y: visualBounds.y - headerH,
        width: frameWidth,
        height: frameHeight,
        layer: "image",
        order: sourceImg.order ?? orderCounter++,
        user: currentUser || sourceImg.user || "",
        rotation: 0,
        tagType: "free",
        tagLabel: label,
        imageName: label,
        imageListOrder: bumpImageListOrderCounter(),
        frameTabs: [{ id: "tab-1", name: "1" }],
        activeFrameTab: "tab-1",
      };

      sourceImg.frameId = frameObj.id;
      sourceImg.frameTab = "background";
      sourceImg.rotation = sourceImg.rotation || 0;
      images.push(frameObj);
      registerUser(frameObj.user);
      refreshImageList();
      emitImageAdd(frameObj);
      emitItemPatch("image", sourceImg, {
        frameId: sourceImg.frameId,
        frameTab: sourceImg.frameTab,
        rotation: sourceImg.rotation,
        ...normalizedPatch,
      });
      selected = { type: "image", index: images.length - 1 };
      currentTool = "select";
      updateToolButtons();
      redraw();
    };

    frameImgEl.src = dataUrl;
    return true;
  }

  function normalizeImageAsFrameBackground(sourceImg, visualBounds) {
    if (!sourceImg || !visualBounds) return {};
    const rotation = normalizeRotation(sourceImg.rotation || 0);
    const mirrored = !!sourceImg.mirrored;
    const bounds = getImageBoundsWorld(sourceImg);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return {};
    const alreadyAligned =
      !rotation &&
      !mirrored &&
      Math.abs(bounds.x - visualBounds.x) < 0.001 &&
      Math.abs(bounds.y - visualBounds.y) < 0.001 &&
      Math.abs(bounds.width - visualBounds.width) < 0.001 &&
      Math.abs(bounds.height - visualBounds.height) < 0.001;
    if (alreadyAligned) return {};

    const sourceEl = sourceImg.img || ensureImageElementForImage(sourceImg, { redrawOnLoad: false });
    if (!sourceEl.complete || !sourceEl.naturalWidth || !sourceEl.naturalHeight) return {};

    const maxDimension = 4096;
    const sourceRatio = Math.max(
      sourceEl.naturalWidth / Math.max(1, Math.abs(bounds.width)),
      sourceEl.naturalHeight / Math.max(1, Math.abs(bounds.height))
    );
    const capRatio = Math.min(
      maxDimension / Math.max(1, Math.abs(visualBounds.width)),
      maxDimension / Math.max(1, Math.abs(visualBounds.height))
    );
    const pixelRatio = Math.max(1, Math.min(4, sourceRatio, capRatio));
    const canvasTag = document.createElement("canvas");
    canvasTag.width = Math.max(1, Math.round(Math.abs(visualBounds.width) * pixelRatio));
    canvasTag.height = Math.max(1, Math.round(Math.abs(visualBounds.height) * pixelRatio));
    const canvasCtx = canvasTag.getContext("2d");
    if (!canvasCtx) return {};

    const center = getRectCenter(bounds);
    canvasCtx.save();
    canvasCtx.translate(
      (center.x - visualBounds.x) * pixelRatio,
      (center.y - visualBounds.y) * pixelRatio
    );
    if (mirrored) canvasCtx.scale(-1, 1);
    if (rotation) canvasCtx.rotate((rotation * Math.PI) / 180);
    canvasCtx.drawImage(
      sourceEl,
      (-bounds.width / 2) * pixelRatio,
      (-bounds.height / 2) * pixelRatio,
      bounds.width * pixelRatio,
      bounds.height * pixelRatio
    );
    canvasCtx.restore();

    const src = canvasTag.toDataURL("image/png");
    const imgEl = new Image();
    imgEl.onload = () => {
      sourceImg.renderImg = createImageRenderSource(imgEl);
      if (sourceImg.id) {
        imageElementCache.set(sourceImg.id, {
          src: sourceImg.src,
          img: imgEl,
          renderImg: sourceImg.renderImg,
        });
      }
      redraw();
    };
    imgEl.src = src;
    if (sourceImg.id) {
      pendingImageLoadTokens.delete(sourceImg.id);
      imageElementCache.delete(sourceImg.id);
    }
    sourceImg.img = imgEl;
    sourceImg.src = src;
    sourceImg.renderImg = null;
    sourceImg.x = visualBounds.x;
    sourceImg.y = visualBounds.y;
    sourceImg.width = visualBounds.width;
    sourceImg.height = visualBounds.height;
    sourceImg.rotation = 0;
    sourceImg.mirrored = false;
    return {
      src,
      x: sourceImg.x,
      y: sourceImg.y,
      width: sourceImg.width,
      height: sourceImg.height,
      rotation: sourceImg.rotation,
      mirrored: sourceImg.mirrored,
    };
  }

  function addTabToSelectedImageOrFrame() {
    const imageIndices = getSelectedImageIndices();
    if (!imageIndices.length) return false;

    let changed = false;
    const tabbedFrameIds = new Set();

    imageIndices.forEach((index) => {
      const imgObj = images[index];
      if (!imgObj) return;

      if (isFrameContainer(imgObj)) {
        if (tabbedFrameIds.has(imgObj.id)) return;
        ensureSnapshotForAction();
        addFrameTab(imgObj);
        tabbedFrameIds.add(imgObj.id);
        changed = true;
        return;
      }

      if (imgObj.frameId) {
        const frame = getFrameById(imgObj.frameId);
        if (frame) {
          if (tabbedFrameIds.has(frame.id)) return;
          ensureSnapshotForAction();
          addFrameTab(frame);
          tabbedFrameIds.add(frame.id);
          const frameIndex = images.findIndex((item) => item?.id === frame.id);
          if (frameIndex >= 0) selected = { type: "image", index: frameIndex };
          changed = true;
          return;
        }
      }

      changed = createTabbedFrameFromImageIndex(index) || changed;
    });

    if (changed) {
      const count = imageIndices.length;
      showTransientFooterMessage(count > 1 ? "選択した画像にタブを追加しました。" : "タブを追加しました。", 2500);
    }
    return changed;
  }

  function editFrameTabName(frameImg, tabId) {
    if (!isFrameContainer(frameImg) || !tabId || tabId === "background") return false;
    const tabs = ensureFrameTabs(frameImg);
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return false;
    const current = String(tab.name || "");
    const oldLabel = getFrameTabDisplayName(frameImg, tabId);
    const next = window.prompt("タブ名を入力", current);
    if (next === null) return true;
    const nextLabel = next.trim() || current || "1";
    tab.name = nextLabel;
    updateTextTagsForRenamedFrameTab(frameImg, tabId, oldLabel, nextLabel);
    emitItemPatch("image", frameImg, { frameTabs: frameImg.frameTabs });
    redraw();
    return true;
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
    imgObj.imageName = label;
    updateTextTagsForRenamedImage(imgObj, current, label);
    refreshFrameImageForCurrentSize(imgObj, { emit: true });
    return true;
  }

  function refreshFrameImageForCurrentSize(imgObj, { emit = false } = {}) {
    if (!imgObj?.tagType) return false;
    const label =
      imgObj.tagType === "omoteura"
        ? getOmoteUraOrientation(imgObj)
        : imgObj.tagLabel ||
          (imgObj.tagType === "omote"
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
      imgObj.tagLabel = imgObj.tagType === "omoteura" ? label : label;
      if (emit && socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "image",
          id: imgObj.id,
          patch: {
            src: imgObj.src,
            x: imgObj.x,
            y: imgObj.y,
            width: imgObj.width,
            height: imgObj.height,
            tagLabel: imgObj.tagLabel,
            tagType: imgObj.tagType,
            imageName: imgObj.imageName || "",
          },
        });
      }
      redraw();
    };
    img.src = dataUrl;
    return true;
  }

  function sortTextsForList(list = texts) {
    return list.slice().sort((a, b) => {
      const ao = typeof a.textListOrder === "number" ? a.textListOrder : a.createdAt || 0;
      const bo = typeof b.textListOrder === "number" ? b.textListOrder : b.createdAt || 0;
      return ao - bo;
    });
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

  function getTextTagKey(tag) {
    return String(tag || "")
      .trim()
      .normalize("NFKC");
  }

  function getTextTagLabel(tag) {
    if (tag && typeof tag === "object") return String(tag.label || tag.name || "").trim();
    return String(tag || "").trim();
  }

  function normalizeTextTagEntry(tag) {
    const label = getTextTagLabel(tag);
    if (!label) return null;
    if (tag && typeof tag === "object") {
      return {
        label,
        sourceId: tag.sourceId || tag.id || null,
        sourceType: tag.sourceType || tag.type || null,
      };
    }
    return { label };
  }

  function getTextTagEntryKey(tag) {
    if (tag?.sourceId) return `${tag.sourceType || "source"}:${tag.sourceId}`;
    return `label:${getTextTagKey(tag?.label)}`;
  }

  function uniqueTextTagEntries(tags) {
    const seen = new Set();
    const unique = [];
    tags.forEach((value) => {
      const tag = normalizeTextTagEntry(value);
      if (!tag) return;
      const key = getTextTagEntryKey(tag);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(tag);
    });
    return unique;
  }

  function parseTextTagEntries(label) {
    if (Array.isArray(label)) {
      return uniqueTextTagEntries(label);
    }
    const value = String(label || "").trim();
    if (!value) return [];
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parseTextTagEntries(parsed);
      } catch {
        // 古い単一ラベルとして扱う
      }
    }
    return uniqueTextTagEntries(value.split(/[,\n、]/));
  }

  function uniqueTextTags(tags) {
    const seen = new Set();
    const unique = [];
    tags.forEach((value) => {
      const tag = getTextTagLabel(value);
      const key = getTextTagKey(tag);
      if (!tag || seen.has(key)) return;
      seen.add(key);
      unique.push(tag);
    });
    return unique;
  }

  function normalizeTextTags(label) {
    return uniqueTextTags(parseTextTagEntries(label).map((tag) => tag.label));
  }

  function getVisibleTextTags(label) {
    return uniqueTextTags(
      parseTextTagEntries(label)
        .map((tag) => tag.label)
        .filter((tag) => {
          const key = getTextTagKey(tag).toLowerCase();
          return key !== "表裏" && key !== "image";
        })
    );
  }

  function serializeTextTags(tags) {
    const normalized = parseTextTagEntries(tags);
    if (!normalized.length) return "";
    const canUseLegacyFormat = normalized.every((tag) => !tag.sourceId && !tag.sourceType);
    if (canUseLegacyFormat) {
      const labels = uniqueTextTags(normalized.map((tag) => tag.label));
      return labels.length === 1 ? labels[0] : JSON.stringify(labels);
    }
    return JSON.stringify(normalized);
  }

  function formatTextTagsForPrompt(tags) {
    return getVisibleTextTags(tags).join(", ");
  }

  function textHasStarLabel(text) {
    return getVisibleTextTags(text?.label).includes("★");
  }

  function toggleSelectedTextStarLabel() {
    if (!selected || selected.type !== "text") return false;
    const text = texts[selected.index];
    if (!text || !isTextVisible(text)) return false;
    const entries = parseTextTagEntries(text.label);
    const hasStar = entries.some((tag) => tag.label === "★");
    const nextEntries = hasStar
      ? entries.filter((tag) => tag.label !== "★")
      : [...entries, { label: "★" }];
    const label = serializeTextTags(nextEntries);
    ensureSnapshotForAction();
    text.label = label;
    emitItemPatch("text", text, { label });
    refreshTextList();
    redraw();
    showTransientFooterMessage(hasStar ? "★ラベルを外しました。" : "★ラベルを付けました。", 2000);
    return true;
  }

  function parseTextTagsInput(value) {
    return parseTextTagEntries(
      String(value || "")
        .split(/[,\n、]/)
        .map((tag) => tag.trim())
    );
  }

  function getFrameDisplayName(imgObj) {
    if (!imgObj?.tagType) return "";
    if (imgObj.tagType === "omoteura") return "表裏";
    return (
      imgObj.tagLabel ||
      imgObj.imageName ||
      (imgObj.tagType === "omote"
        ? "表"
        : imgObj.tagType === "ura"
        ? "裏"
        : "フレーム")
    );
  }

  function openTextList() {
    textListOpen = true;
    openFloatingTextList();
    textListPanel.classList.remove("hidden");
    positionTextListPanel();
    renderTextList();
  }

  function closeTextList() {
    textListOpen = false;
    textListPanel.classList.add("hidden");
    closeFloatingTextList();
    textListPanel.style.maxHeight = "";
    if (textListBody) textListBody.style.maxHeight = "";
    textListPanel.style.top = "";
    textListPanel.style.bottom = "";
  }

  function updateTextListDuplicateButton() {
    const disabled = textListSelectedIds.size === 0;
    if (textListDuplicateGridBtn) textListDuplicateGridBtn.disabled = disabled;
    if (textListCopyPlainBtn) textListCopyPlainBtn.disabled = disabled;
    if (textListCopyTaggedBtn) textListCopyTaggedBtn.disabled = disabled;
  }

  function clearTextListSelection() {
    if (textListSelectedIds.size === 0) return;
    textListSelectedIds.clear();
    if (textListOpen) renderTextList();
    else updateTextListDuplicateButton();
  }

  function getSelectedTextListItems() {
    const selectedIds = new Set(textListSelectedIds);
    return getVisibleTextsForList({ ignoreStarFilter: true }).filter((t) => selectedIds.has(t.id));
  }

  function duplicateSelectedTextListAsGrid() {
    const targets = getSelectedTextListItems();
    if (!targets.length) {
      showTransientFooterMessage("複製するテキストを選択してください。", 3000);
      updateTextListDuplicateButton();
      return;
    }
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    if (activeLayer === "image") return;

    const copies = targets
      .map((source) => ({
        source,
        lines: (source.lines && source.lines.length ? source.lines : [""]).filter((line) => line.length > 0),
        fontSize: source.fontSize || textDefaultFontSizeWorld || 16,
      }))
      .filter((copy) => copy.lines.length > 0);
    if (!copies.length) {
      clearTextListSelection();
      showTransientFooterMessage("複製できるテキストがありません。", 3000);
      return;
    }

    pendingTextListGridCopies = copies;
    clearTextListSelection();
    pendingTextMode = null;
    resetShapeMode();
    currentTool = "select";
    selected = null;
    multiSelection = null;
    updateToolButtons();
    showTransientFooterMessage("複製した文字：配置したい場所をクリックしてください。", 4000);
  }

  function placePendingTextListGridCopies(worldPos) {
    if (!pendingTextListGridCopies?.length || !worldPos) return false;
    if (!requireUser()) return false;
    if (!canCreateOnCurrentLayer()) return false;
    if (activeLayer === "image") return false;

    ensureSnapshotForAction();
    const targetLayer = getTextLayerForCurrentLayer();
    let createdCount = 0;
    let currentY = worldPos.y;

    pendingTextListGridCopies.forEach(({ source, lines, fontSize }) => {
      lines.forEach((line, row) => {
        const clone = {
          ...source,
          id: genId(),
          lines: [line],
          x: worldPos.x,
          y: currentY + row * fontSize,
          fontSize,
          layer: targetLayer,
          order: orderCounter++,
          createdAt: Date.now(),
          user: currentUser,
          label: "",
          rotation: 0,
          vertical: false,
          gridText: true,
          frameId: null,
          frameTab: null,
        };
        applyFrameMembershipByPoint(clone, { x: clone.x, y: clone.y });
        addTextObject(clone);
        createdCount += 1;
      });
      currentY += lines.length * fontSize;
    });
    pendingTextListGridCopies = null;

    if (!createdCount) {
      showTransientFooterMessage("複製できるテキストがありません。", 3000);
      return false;
    }
    selected = { type: "text", index: texts.length - 1 };
    multiSelection = null;
    refreshTextList();
    redraw();
    updateFooterByState();
    return true;
  }

  function renderTextList() {
    if (!textListOpen) return;
    textListBody.innerHTML = "";
    const availableTextIds = new Set(getVisibleTextsForList({ ignoreStarFilter: true }).map((t) => t.id));
    const sorted = getVisibleTextsForList();
    sorted.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "text-list-item";
      item.draggable = true;
      item.dataset.id = t.id;

      const labelRow = document.createElement("div");
      labelRow.className = "text-label-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "text-list-checkbox";
      checkbox.checked = textListSelectedIds.has(t.id);
      checkbox.setAttribute("aria-label", "テキストを選択");
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) textListSelectedIds.add(t.id);
        else textListSelectedIds.delete(t.id);
        item.classList.toggle("selected", checkbox.checked);
        updateTextListDuplicateButton();
      });
      const meta = document.createElement("span");
      meta.className = "text-list-meta";
      meta.textContent = `#${idx + 1}`;
      const dragHandle = document.createElement("span");
      dragHandle.className = "text-list-drag-handle";
      dragHandle.textContent = "↕";
      dragHandle.title = "ドラッグして並び替え";
      const tags = getVisibleTextTags(t.label);
      const tagButton = document.createElement("span");
      tagButton.className = "text-label-badge";
      tagButton.textContent = tags.length ? tags.join(" / ") : "#";
      tagButton.title = "タグを編集";
      tagButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = formatTextTagsForPrompt(t.label);
        const next = window.prompt("タグをカンマ区切りで入力", current);
        if (next === null) return;
        setTextTags(t.id, parseTextTagsInput(next));
      });

      labelRow.appendChild(checkbox);
      labelRow.appendChild(dragHandle);
      labelRow.appendChild(meta);
      labelRow.appendChild(tagButton);

      const content = document.createElement("div");
      content.className = "text-list-content";
      content.innerHTML = linkifyText(t.lines.join("\n"));
      content.title = "クリックして編集";
      content.addEventListener("pointerdown", (e) => {
        if (e.target.closest("a")) return;
        e.preventDefault();
        e.stopPropagation();
        focusTextFromList(t.id);
        startTextListInlineEdit(item, t, content);
      });

      item.appendChild(labelRow);
      item.appendChild(content);
      item.classList.toggle("selected", textListSelectedIds.has(t.id));

      item.addEventListener("click", () => {
        focusTextFromList(t.id);
      });
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        clearTextListDropIndicators();
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
        clearTextListDropIndicators(item);
        item.classList.toggle("insert-before", position === "before");
        item.classList.toggle("insert-after", position === "after");
        item.dataset.dropPosition = position;
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("insert-before", "insert-after");
        delete item.dataset.dropPosition;
      });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const position = item.dataset.dropPosition === "after" ? "after" : "before";
        clearTextListDropIndicators();
        const sourceId = e.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === t.id) return;
        reorderTextList(sourceId, t.id, position);
      });

      textListBody.appendChild(item);
    });
    Array.from(textListSelectedIds).forEach((id) => {
      if (!availableTextIds.has(id)) textListSelectedIds.delete(id);
    });
    updateTextListDuplicateButton();
    positionTextListPanel();
  }

  function isTextListVisibleText(text) {
    return !!text && text.layer !== "draft" && !text.gridText;
  }

  function getVisibleTextsForList({ ignoreStarFilter = false } = {}) {
    return sortTextsForList().filter(
      (text) =>
        isTextListVisibleText(text) &&
        (ignoreStarFilter || !textListStarOnlyEnabled || textHasStarLabel(text))
    );
  }

  function focusTextFromList(textId) {
    const targetIdx = findIndexById(texts, textId);
    if (targetIdx < 0) return;
    const target = texts[targetIdx];
    offsetX = canvas.width / 2 - target.x * scale;
    offsetY = canvas.height / 2 - target.y * scale;
    selected = { type: "text", index: targetIdx };
    multiSelection = null;
    currentTool = "select";
    updateToolButtons();
    redraw();
  }

  function startTextListInlineEdit(item, text, contentEl) {
    if (!item || !text || item.querySelector(".text-list-content-input")) return;
    const textarea = document.createElement("textarea");
    textarea.className = "text-list-content-input";
    textarea.value = (text.lines || []).join("\n");
    textarea.setAttribute(
      "aria-label",
      "テキスト編集。Enterで確定、Shift+Enterで改行、Tabで次へ"
    );
    item.draggable = false;
    contentEl.replaceWith(textarea);
    textarea.focus();
    textarea.select();
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      item.draggable = true;
      if (commit) {
        const value = textarea.value;
        const trimmed = value.trim();
        if (trimmed) {
          const lines = value.split(/\r?\n/);
          if (value !== (text.lines || []).join("\n")) {
            text.lines = lines;
            emitItemPatch("text", text, { lines });
            redraw();
          }
        }
      }
      refreshTextList();
    };

    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("pointerdown", (e) => e.stopPropagation());
    textarea.addEventListener("dragstart", (e) => e.preventDefault());
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;
    });
    textarea.addEventListener("blur", () => finish(true));
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const ordered = getVisibleTextsForList();
        const currentIndex = ordered.findIndex((entry) => entry.id === text.id);
        const nextText = ordered[currentIndex + (e.shiftKey ? -1 : 1)];
        finish(true);
        if (nextText) {
          focusTextFromList(nextText.id);
          requestAnimationFrame(() => {
            const escapedId = window.CSS?.escape
              ? CSS.escape(nextText.id)
              : String(nextText.id).replace(/"/g, '\\"');
            const nextItem = textListBody?.querySelector(
              `.text-list-item[data-id="${escapedId}"]`
            );
            const nextContent = nextItem?.querySelector(".text-list-content");
            if (nextItem && nextContent) {
              startTextListInlineEdit(nextItem, nextText, nextContent);
            }
          });
        }
      }
    });
  }

  function clearTextListDropIndicators(except = null) {
    textListBody?.querySelectorAll(".text-list-item").forEach((item) => {
      if (item === except) return;
      item.classList.remove("insert-before", "insert-after");
      delete item.dataset.dropPosition;
    });
  }

  function reorderTextList(sourceId, targetId, position = "before") {
    const ordered = getVisibleTextsForList({ ignoreStarFilter: true });
    const from = ordered.findIndex((text) => text.id === sourceId);
    if (from < 0) return;
    const [moved] = ordered.splice(from, 1);
    const targetIndex = ordered.findIndex((text) => text.id === targetId);
    if (targetIndex < 0) return;
    const insertIndex = targetIndex + (position === "after" ? 1 : 0);
    ordered.splice(insertIndex, 0, moved);
    ordered.forEach((text, idx) => {
      text.textListOrder = idx + 1;
      emitItemPatch("text", text, { textListOrder: text.textListOrder });
    });
    textListOrderCounter = Math.max(
      textListOrderCounter,
      ...texts.map((text) => Number(text.textListOrder) || 0)
    );
    renderTextList();
  }

  function getTextCreatedSortValue(text) {
    const value = Number(text?.createdAt);
    return Number.isFinite(value) ? value : 0;
  }

  function getTextTagSortValue(text) {
    const tags = getVisibleTextTags(text?.label)
      .map((tag) => tag.normalize("NFKC").toLowerCase())
      .sort((a, b) => a.localeCompare(b, "ja"));
    return tags.length ? tags.join("\n") : "\uffff";
  }

  function compareTextCreatedOrder(a, b) {
    const createdDiff = getTextCreatedSortValue(a) - getTextCreatedSortValue(b);
    if (createdDiff) return createdDiff;
    return String(a?.id || "").localeCompare(String(b?.id || ""), "ja");
  }

  function applyTextListOrder(ordered) {
    ordered.forEach((text, idx) => {
      text.textListOrder = idx + 1;
      emitItemPatch("text", text, { textListOrder: text.textListOrder });
    });
    textListOrderCounter = Math.max(
      textListOrderCounter,
      ...texts.map((text) => Number(text.textListOrder) || 0)
    );
    renderTextList();
  }

  function sortTextListByTag() {
    const ordered = getVisibleTextsForList({ ignoreStarFilter: true }).sort((a, b) => {
      const tagDiff = getTextTagSortValue(a).localeCompare(getTextTagSortValue(b), "ja");
      return tagDiff || compareTextCreatedOrder(a, b);
    });
    applyTextListOrder(ordered);
  }

  function sortTextListByKana() {
    const collator = new Intl.Collator("ja", {
      usage: "sort",
      sensitivity: "base",
      numeric: true,
    });
    const getSortValue = (text) =>
      (text?.lines || []).join("\n").trim().normalize("NFKC").toLowerCase();
    const ordered = getVisibleTextsForList({ ignoreStarFilter: true }).sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (!aValue && bValue) return 1;
      if (aValue && !bValue) return -1;
      return collator.compare(aValue, bValue) || compareTextCreatedOrder(a, b);
    });
    applyTextListOrder(ordered);
  }

  function sortTextListByCreated() {
    const ordered = getVisibleTextsForList({ ignoreStarFilter: true }).sort(compareTextCreatedOrder);
    applyTextListOrder(ordered);
  }

  function buildTextListPlainText() {
    const list = getSelectedTextListItems();
    if (!list.length) return "";
    return list
      .map((t) => (t.lines || []).join("\n"))
      .join("\n\n");
  }

  function buildTextListTaggedText() {
    const list = getSelectedTextListItems();
    if (!list.length) return "";
    return list
      .map((t) => {
        const tags = getVisibleTextTags(t.label);
        const label = tags.length ? tags.join(" / ") : "(タグなし)";
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
      .filter(({ img }) => !isFrameContainer(img) && !isOmoteUraTagImage(img))
      .sort((a, b) => {
        const ao = typeof a.img.imageListOrder === "number" ? a.img.imageListOrder : a.img.order ?? a.index;
        const bo = typeof b.img.imageListOrder === "number" ? b.img.imageListOrder : b.img.order ?? b.index;
        return ao - bo;
      });
  }

  function openImageList() {
    imageListOpen = true;
    openListPopup(imageListPanel, "画像一覧", () => {
      imageListOpen = false;
    });
    imageListPanel.classList.remove("hidden");
    positionImageListPanel();
    renderImageList();
  }

  function closeImageList() {
    imageListOpen = false;
    imageListPanel.classList.add("hidden");
    closeListPopup(imageListPanel);
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

  function openLinkList() {
    linkListOpen = true;
    openListPopup(linkListPanel, "リンク集", () => {
      linkListOpen = false;
    });
    linkListPanel.classList.remove("hidden");
    positionLinkListPanel();
    renderLinkList();
  }

  function closeLinkList() {
    linkListOpen = false;
    linkListPanel.classList.add("hidden");
    closeListPopup(linkListPanel);
    linkListPanel.style.maxHeight = "";
    if (linkListBody) linkListBody.style.maxHeight = "";
    linkListPanel.style.top = "";
    linkListPanel.style.bottom = "";
  }

  function refreshLinkList() {
    if (linkListOpen) renderLinkList();
  }

  function activateFloatingAppWindow(frame) {
    if (!frame) return;
    document.querySelectorAll(".floating-app-window.active").forEach((item) => {
      if (item !== frame) item.classList.remove("active");
    });
    frame.classList.add("active");
    frame.style.zIndex = String(++floatingLinkBoardZ);
    syncToolbarToActiveDraftBoard();
  }

  function activateTopFloatingAppWindow() {
    const next = Array.from(document.querySelectorAll(".floating-app-window"))
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
    next?.classList.add("active");
  }

  function getSharedToolbarState() {
    return {
      tool: pendingTextMode ? `text:${pendingTextMode}` : currentTool,
      color: currentColor,
      size: currentSize,
      strokesDimmed,
      user: currentUser,
      glowColor: getCurrentFavoriteColor(),
    };
  }

  function syncToolbarToActiveDraftBoard() {
    if (draftBoardViewId || linkBoardView) return;
    const iframe = document.querySelector(
      ".floating-draft-board.active iframe, .floating-link-board.active iframe"
    );
    iframe?.contentWindow?.postMessage(
      { type: "whiteboard:draft-toolbar", state: getSharedToolbarState() },
      window.location.origin
    );
  }

  function enableFloatingWindowDrag(frame, handle) {
    let drag = null;
    frame.addEventListener("pointerdown", () => activateFloatingAppWindow(frame));
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, input, label, a")) return;
      const rect = frame.getBoundingClientRect();
      drag = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      handle.setPointerCapture?.(event.pointerId);
      activateFloatingAppWindow(frame);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const minLeft = Math.min(0, 80 - frame.offsetWidth);
      const maxLeft = Math.max(minLeft, window.innerWidth - 80);
      const maxTop = Math.max(0, window.innerHeight - 38);
      frame.style.left = `${Math.min(Math.max(minLeft, event.clientX - drag.dx), maxLeft)}px`;
      frame.style.top = `${Math.min(Math.max(0, event.clientY - drag.dy), maxTop)}px`;
      frame.style.right = "auto";
      frame.style.bottom = "auto";
    });
    const endDrag = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      handle.releasePointerCapture?.(event.pointerId);
      drag = null;
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function openFloatingTextList() {
    if (textListFloatingFrame?.isConnected) {
      activateFloatingAppWindow(textListFloatingFrame);
      return;
    }
    const frame = document.createElement("section");
    frame.className = "floating-app-window floating-text-list";
    frame.style.left = "120px";
    frame.style.top = "70px";
    frame.style.width = "480px";
    frame.style.height = "min(720px, calc(100vh - 90px))";
    frame.appendChild(textListPanel);
    document.body.appendChild(frame);
    textListFloatingFrame = frame;
    const handle = textListPanel.querySelector(".text-list-header");
    if (handle) enableFloatingWindowDrag(frame, handle);
    activateFloatingAppWindow(frame);
  }

  function closeFloatingTextList() {
    const frame = textListFloatingFrame;
    if (!frame) return;
    const wasActive = frame.classList.contains("active");
    document.body.appendChild(textListPanel);
    frame.remove();
    textListFloatingFrame = null;
    if (wasActive) activateTopFloatingAppWindow();
  }

  function openFloatingTrackingWindow(user) {
    const key = encodeURIComponent(user);
    const existing = document.querySelector(`.floating-tracking-window[data-user="${CSS.escape(user)}"]`);
    if (existing) {
      activateFloatingAppWindow(existing);
      return;
    }
    const frame = document.createElement("section");
    frame.className = "floating-app-window floating-tracking-window";
    frame.dataset.user = user;
    frame.style.left = `${140 + document.querySelectorAll(".floating-tracking-window").length * 26}px`;
    frame.style.top = `${90 + document.querySelectorAll(".floating-tracking-window").length * 26}px`;
    frame.style.width = "min(720px, calc(100vw - 40px))";
    frame.style.height = "min(540px, calc(100vh - 60px))";
    const header = document.createElement("header");
    header.className = "floating-app-window-header";
    const title = document.createElement("span");
    title.textContent = `👀 ${user} を追跡`;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "floating-app-window-close";
    close.textContent = "×";
    const iframe = document.createElement("iframe");
    iframe.className = "floating-app-window-content";
    iframe.src = `${window.location.pathname}?follow=${key}`;
    iframe.title = `${user}を追跡`;
    header.append(title, close);
    frame.append(header, iframe);
    document.body.appendChild(frame);
    enableFloatingWindowDrag(frame, header);
    close.addEventListener("click", () => {
      const wasActive = frame.classList.contains("active");
      frame.remove();
      if (wasActive) activateTopFloatingAppWindow();
    });
    activateFloatingAppWindow(frame);
  }

  function openFloatingDraftBoard(boardImg) {
    if (!boardImg?.id) return;
    const existing = document.querySelector(`.floating-draft-board[data-board-id="${CSS.escape(boardImg.id)}"]`);
    if (existing) {
      activateFloatingAppWindow(existing);
      return;
    }
    const frame = document.createElement("section");
    frame.className = "floating-app-window floating-draft-board";
    frame.dataset.boardId = boardImg.id;
    frame.style.left = "150px";
    frame.style.top = "90px";
    frame.style.width = "min(760px, calc(100vw - 40px))";
    frame.style.height = "min(580px, calc(100vh - 60px))";
    const header = document.createElement("header");
    header.className = "floating-app-window-header";
    const title = document.createElement("span");
    title.textContent = "下書きボード";
    const actions = document.createElement("div");
    actions.className = "floating-draft-board-actions";
    const publish = document.createElement("button");
    publish.type = "button";
    publish.textContent = "ここに公開";
    const publishSource = document.createElement("button");
    publishSource.type = "button";
    publishSource.textContent = "リンク元に公開";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "削除";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "floating-app-window-close";
    close.textContent = "×";
    actions.append(publish, publishSource, remove, close);
    header.append(title, actions);
    const iframe = document.createElement("iframe");
    iframe.className = "floating-app-window-content";
    iframe.src = `${window.location.pathname}?draftBoard=${encodeURIComponent(boardImg.id)}`;
    iframe.title = "下書きボード";
    frame.append(header, iframe);
    document.body.appendChild(frame);
    openFloatingDraftBoardIds.add(boardImg.id);
    redraw();
    enableFloatingWindowDrag(frame, header);
    iframe.addEventListener("load", syncToolbarToActiveDraftBoard);
    const closeFrame = () => {
      const wasActive = frame.classList.contains("active");
      frame.remove();
      openFloatingDraftBoardIds.delete(boardImg.id);
      redraw();
      if (wasActive) activateTopFloatingAppWindow();
    };
    frame._closeFloating = closeFrame;
    close.addEventListener("click", closeFrame);
    publish.addEventListener("click", () => {
      publish.disabled = true;
      publishSource.disabled = true;
      remove.disabled = true;
      const iframeRect = iframe.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const topLeft = screenToWorld(iframeRect.left - canvasRect.left, iframeRect.top - canvasRect.top);
      iframe.contentWindow?.postMessage(
        {
          type: "whiteboard:draft-command",
          command: "publish",
          toolbarState: getSharedToolbarState(),
          targetRect: {
            x: topLeft.x,
            y: topLeft.y,
            width: boardImg.width,
            height: boardImg.height,
          },
        },
        window.location.origin
      );
    });
    publishSource.addEventListener("click", () => {
      publish.disabled = true;
      publishSource.disabled = true;
      remove.disabled = true;
      iframe.contentWindow?.postMessage(
        {
          type: "whiteboard:draft-command",
          command: "publish-source",
          toolbarState: getSharedToolbarState(),
          originalObjectIds: Array.isArray(boardImg.draftBoardSource?.originalObjectIds)
            ? boardImg.draftBoardSource.originalObjectIds.slice()
            : null,
        },
        window.location.origin
      );
    });
    remove.addEventListener("click", () => {
      publish.disabled = true;
      publishSource.disabled = true;
      remove.disabled = true;
      iframe.contentWindow?.postMessage(
        { type: "whiteboard:draft-command", command: "delete" },
        window.location.origin
      );
    });
    activateFloatingAppWindow(frame);
  }

  function restoreFloatingDraftBoards() {
    if (!currentUser || draftBoardViewId || linkBoardView || followTargetUser) return;
    images.forEach((img) => {
      if (
        img?.user === currentUser &&
        img.draftBoardSource?.floating &&
        !document.querySelector(`.floating-draft-board[data-board-id="${CSS.escape(img.id)}"]`)
      ) {
        openFloatingDraftBoard(img);
      }
    });
  }

  function migrateLegacyDraftBoardOriginalIds() {
    if (!currentUser || linkBoardView || followTargetUser) return;
    const near = (a, b, tolerance = 1) => Math.abs((a || 0) - (b || 0)) <= tolerance;
    images.forEach((board) => {
      const source = board?.draftBoardSource;
      if (!source || board.user !== currentUser || Array.isArray(source.originalObjectIds)) return;
      const contentDest = {
        x: board.x,
        y: board.y + (source.headerHeight || 0),
        width: board.width,
        height: Math.max(1, board.height - (source.headerHeight || 0)),
      };
      const sourceRect = { x: source.x, y: source.y, width: source.width, height: source.height };
      const ids = new Set();

      draftStrokes
        .filter((item) => item?.draftBoardId === board.id)
        .forEach((draft) => {
          const match = strokes.find((original) => {
            if (!original || original.fill !== draft.fill || original.color !== draft.color) return false;
            if ((original.points || []).length !== (draft.points || []).length) return false;
            const mapped = (original.points || []).map((point) => mapRectPointBetweenRects(point, sourceRect, contentDest));
            return mapped.every((point, index) => near(point.x, draft.points[index]?.x) && near(point.y, draft.points[index]?.y));
          });
          if (match) ids.add(draft.id);
        });

      texts
        .filter((item) => item?.draftBoardId === board.id)
        .forEach((draft) => {
          const match = texts.find((original) => {
            if (!original || original.draftBoardId || (original.lines || []).join("\n") !== (draft.lines || []).join("\n")) return false;
            const mapped = mapRectPointBetweenRects({ x: original.x, y: original.y }, sourceRect, contentDest);
            return near(mapped.x, draft.x) && near(mapped.y, draft.y);
          });
          if (match) ids.add(draft.id);
        });

      images
        .filter((item) => item?.draftBoardId === board.id)
        .forEach((draft) => {
          const match = images.find((original) => {
            if (!original || original.draftBoardId || original.id === board.id || original.src !== draft.src) return false;
            const mapped = mapRectBetweenRects(getImageBoundsWorld(original), sourceRect, contentDest);
            return near(mapped.x, draft.x) && near(mapped.y, draft.y) && near(mapped.width, draft.width) && near(mapped.height, draft.height);
          });
          if (match) ids.add(draft.id);
        });

      board.draftBoardSource = { ...source, floating: true, originalObjectIds: Array.from(ids) };
      emitItemPatch("image", board, { draftBoardSource: board.draftBoardSource });
    });
  }

  function restoreListPanel(panel) {
    const home = listPanelHomes.get(panel);
    if (!home || panel.ownerDocument === document) return;
    const nextSibling = home.nextSibling?.parentNode === home.parent ? home.nextSibling : null;
    home.parent.insertBefore(panel, nextSibling);
  }

  function openListPopup(panel, title, onClosed) {
    if (!panel) return false;
    const current = listPopupWindows.get(panel);
    if (current && !current.closed) {
      current.focus();
      return true;
    }
    if (!listPanelHomes.has(panel)) {
      listPanelHomes.set(panel, {
        parent: panel.parentNode,
        nextSibling: panel.nextSibling,
      });
    }

    const popup = window.open(
      "",
      `whiteboard-list-${boardId}-${panel.id}`,
      "popup=yes,width=480,height=720,resizable=yes,scrollbars=no"
    );
    if (!popup) return false;

    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/style.css"><style>html,body{height:100%;margin:0;overflow:hidden;background:#fff}body{min-width:0}.text-list-panel{position:static!important;width:100%!important;height:100vh;max-height:none!important;box-sizing:border-box;border:0;border-radius:0}.text-list-body{flex:1;max-height:none!important}.text-list-controls>span,.text-list-controls>button{white-space:nowrap}.text-list-star-filter{width:auto!important}</style></head><body></body></html>`);
    popup.document.close();
    popup.document.body.appendChild(panel);
    listPopupWindows.set(panel, popup);
    popup.addEventListener("beforeunload", () => {
      if (listPopupWindows.get(panel) !== popup) return;
      listPopupWindows.delete(panel);
      restoreListPanel(panel);
      panel.classList.add("hidden");
      onClosed();
    });
    popup.focus();
    return true;
  }

  function closeListPopup(panel) {
    const popup = listPopupWindows.get(panel);
    if (!popup) return;
    listPopupWindows.delete(panel);
    restoreListPanel(panel);
    if (!popup.closed) popup.close();
  }

  function isListPanelInPopup(panel) {
    return !!panel && panel.ownerDocument !== document;
  }

  function positionLinkListPanel() {
    if (!linkListPanel || linkListPanel.classList.contains("hidden")) return;
    if (isListPanelInPopup(linkListPanel)) return;
    const margin = 12;
    const footerSpace = getFooterSpace() + margin;
    const toolbarBottom = toolbarEl ? toolbarEl.getBoundingClientRect().bottom + margin : 60;
    const top = Math.max(margin, toolbarBottom);
    linkListPanel.style.top = `${top}px`;
    linkListPanel.style.bottom = "auto";
    const available = window.innerHeight - top - footerSpace - margin;
    const maxH = Math.max(260, available);
    linkListPanel.style.maxHeight = `${maxH}px`;
    if (linkListBody) {
      const header = linkListPanel.querySelector(".text-list-header");
      const headerH = header ? header.getBoundingClientRect().height : 44;
      linkListBody.style.maxHeight = `${Math.max(180, maxH - headerH)}px`;
    }
  }

  function renderLinkList() {
    if (!linkListOpen || !linkListBody) return;
    linkListBody.innerHTML = "";
    links
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .forEach((link) => {
        const item = document.createElement("div");
        item.className = "link-list-item";
        const title = document.createElement("button");
        title.type = "button";
        title.className = "link-list-title";
        title.textContent = link.title || link.url;
        title.title = link.url;
        title.addEventListener("click", (e) => {
          e.stopPropagation();
          focusLinkFromList(link.id);
          startLinkTitleInlineEdit(item, link, title);
        });
        const url = document.createElement("a");
        url.href = link.url;
        url.target = "_blank";
        url.rel = "noopener noreferrer";
        url.className = "link-list-url";
        url.textContent = link.url;
        item.appendChild(title);
        item.appendChild(url);
        item.addEventListener("click", () => focusLinkFromList(link.id));
        linkListBody.appendChild(item);
      });
    positionLinkListPanel();
  }

  function startLinkTitleInlineEdit(item, link, titleEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "link-list-title-input";
    input.value = link.title || "";
    input.placeholder = "タイトル";
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      if (commit) {
        const title = input.value.trim() || link.url;
        if (title !== link.title) {
          link.title = title;
          emitItemPatch("link", link, { title });
        }
      }
      refreshLinkList();
      redraw();
    };

    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
  }

  function shouldRefreshLinkPreview(link) {
    if (!link?.url) return false;
    return !link.image || !link.title || link.title === link.url;
  }

  async function refreshLinkPreviewIfNeeded(link) {
    if (!shouldRefreshLinkPreview(link) || linkPreviewRefreshes.has(link.id)) return;
    linkPreviewRefreshes.add(link.id);
    const preview = await fetchLinkPreview(link.url);
    linkPreviewRefreshes.delete(link.id);
    const patch = {};
    if (preview.title && (!link.title || link.title === link.url)) patch.title = preview.title;
    if (preview.description && !link.description) patch.description = preview.description;
    if (preview.image && !link.image) patch.image = preview.image;
    if (preview.favicon && !link.favicon) patch.favicon = preview.favicon;
    if (preview.siteName && !link.siteName) patch.siteName = preview.siteName;
    if (!Object.keys(patch).length) return;
    Object.assign(link, patch);
    emitItemPatch("link", link, patch);
    refreshLinkList();
    redraw();
  }

  function focusLinkFromList(linkId) {
    const targetIdx = findIndexById(links, linkId);
    if (targetIdx < 0) return;
    const target = links[targetIdx];
    offsetX = canvas.width / 2 - (target.x + target.width / 2) * scale;
    offsetY = canvas.height / 2 - (target.y + target.height / 2) * scale;
    selected = { type: "link", index: targetIdx };
    currentTool = "select";
    updateToolButtons();
    redraw();
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
      name.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        focusImageFromList(img.id);
        startImageNameInlineEdit(item, img, name);
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

  function startImageNameInlineEdit(item, img, nameEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "image-list-name-input";
    input.value = img.imageName || "";
    input.placeholder = "画像名なし";
    item.draggable = false;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      item.draggable = true;
      if (commit) {
        const imageName = input.value.trim();
        const oldName = img.imageName || "";
        if (imageName !== oldName) {
          img.imageName = imageName;
          emitItemPatch("image", img, { imageName });
          updateTextTagsForRenamedImage(img, oldName, imageName);
          syncImageNameToLinkedFrames(img, imageName);
        }
      }
      refreshImageList();
    };

    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("dragstart", (e) => e.preventDefault());
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const ordered = sortImagesForList().map(({ img }) => img);
        const currentIndex = ordered.findIndex((entry) => entry.id === img.id);
        const nextIndex = currentIndex + (e.shiftKey ? -1 : 1);
        const nextImg = ordered[nextIndex];
        finish(true);
        if (nextImg) {
          focusImageFromList(nextImg.id);
          requestAnimationFrame(() => {
            const escapedId = window.CSS?.escape ? CSS.escape(nextImg.id) : String(nextImg.id).replace(/"/g, '\\"');
            const nextItem = imageListBody?.querySelector(`.image-list-item[data-id="${escapedId}"]`);
            const nextName = nextItem?.querySelector(".image-list-name");
            if (nextItem && nextName) startImageNameInlineEdit(nextItem, nextImg, nextName);
          });
        }
      }
    });
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

  function toggleLinkListPanelView() {
    if (linkListOpen) {
      closeLinkList();
    } else {
      openLinkList();
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
    if (textListFloatingFrame) return;
    if (isListPanelInPopup(textListPanel)) return;
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
      const controls = textListPanel.querySelector(".text-list-controls");
      const controlsH = controls ? controls.getBoundingClientRect().height : 0;
      const bodyMax = Math.max(180, maxH - headerH - controlsH);
      textListBody.style.maxHeight = `${bodyMax}px`;
    }
  }

  function positionImageListPanel() {
    if (!imageListPanel || imageListPanel.classList.contains("hidden")) return;
    if (isListPanelInPopup(imageListPanel)) return;
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

  function setTextTags(textId, tags) {
    const idx = findIndexById(texts, textId);
    if (idx < 0) return;
    const label = serializeTextTags(tags);
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
    document.title = followTargetUser
      ? `${followTargetUser}を追跡 - ${boardTitle}`
      : linkBoardView
      ? `リンクボード - ${boardTitle}`
      : `${boardTitle}`;
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
    const favoriteColor = getUserRegisteredFavoriteColor(trimmed);
    try {
      const res = await fetch(`/api/boards/${boardId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, favoriteColor }),
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
    if (localScreenShareActive && localScreenStream && socketConnected) {
      socket.emit("screen-share:status", { boardId, active: true, user: currentUser });
      if (screenShareLabel) screenShareLabel.textContent = `${currentUser || "画面共有"} の画面共有`;
    }
  }

  function requireUser() {
    if (currentUser) return true;
    if (isDetachedBoardView) return false;
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
    invalidatePendingImageLoad(removed?.id);
    if (removed && socketConnected) {
      socket.emit("item:remove", { boardId, type: "image", id: removed.id });
    }
    refreshImageList();
    selected = null;
    redraw();
  }

  function getSelectedFrameIds() {
    return getSelectionItems()
      .filter((item) => item.type === "image" && isFrameContainer(images[item.index]))
      .map((item) => images[item.index]?.id)
      .filter(Boolean);
  }

  function openFrameDeleteModal() {
    if (!frameDeleteModal) return false;
    frameDeleteModal.classList.remove("hidden");
    hideContextMenu();
    return true;
  }

  function closeFrameDeleteModal() {
    if (frameDeleteModal) frameDeleteModal.classList.add("hidden");
  }

  function addFrameContentsToDeleteSets(frameImg, strokeIds, textIds, imageIds, draftIds) {
    if (!isFrameContainer(frameImg)) return;
    getFrameContentItems(frameImg).forEach((item) => {
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (st) strokeIds.add(st.id);
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t) textIds.add(t.id);
      } else if (item.type === "draft") {
        const d = draftStrokes[item.index];
        if (d) draftIds.add(d.id);
      } else if (item.type === "image") {
        const img = images[item.index];
        if (!img) return;
        imageIds.add(img.id);
        if (isFrameContainer(img)) addFrameContentsToDeleteSets(img, strokeIds, textIds, imageIds, draftIds);
      }
    });
  }

  function addDraftBoardContentsToDeleteSets(boardImg, strokeIds, textIds, imageIds, draftIds) {
    if (!isDraftBoardImage(boardImg) || boardImg.user !== currentUser) return;
    const draftBoardId = boardImg.id;
    draftStrokes.forEach((draft) => {
      if (draft?.draftBoardId === draftBoardId && draft.user === currentUser) draftIds.add(draft.id);
    });
    texts.forEach((text) => {
      if (text?.draftBoardId === draftBoardId && text.user === currentUser) textIds.add(text.id);
    });
    images.forEach((img) => {
      if (!img || img.id === draftBoardId) return;
      if (img.draftBoardId === draftBoardId && img.user === currentUser) imageIds.add(img.id);
    });
  }

  function detachFrameContents(frameImg) {
    if (!isFrameContainer(frameImg)) return;
    getFrameContentItems(frameImg).forEach((item) => {
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (!st) return;
        st.frameId = null;
        st.frameTab = null;
        emitItemPatch("stroke", st, { frameId: null, frameTab: null });
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (!t) return;
        t.frameId = null;
        t.frameTab = null;
        emitItemPatch("text", t, { frameId: null, frameTab: null });
      } else if (item.type === "image") {
        const img = images[item.index];
        if (!img) return;
        img.frameId = null;
        img.frameTab = null;
        emitItemPatch("image", img, { frameId: null, frameTab: null });
      } else if (item.type === "draft") {
        const d = draftStrokes[item.index];
        if (!d) return;
        d.frameId = null;
        d.frameTab = null;
        if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: d });
      }
    });
  }

  function deleteSelection(frameDeleteMode = null) {
    const selectedFrameIds = getSelectedFrameIds();
    if (selectedFrameIds.length && !frameDeleteMode) {
      if (openFrameDeleteModal()) return;
    }

    ensureSnapshotForAction();
    const allowUserLayer =
      activeLayer === "user" || activeLayer === "admin" || activeLayer === "base" || activeLayer === "draft";
    const allowImages =
      activeLayer === "image" ||
      activeLayer === "admin" ||
      (activeLayer === "user" && !!currentUser);
    const strokeIds = new Set();
    const textIds = new Set();
    const imageIds = new Set();
    const linkIds = new Set();
    const draftIds = new Set();

    const collect = (item) => {
      if (!allowUserLayer && item.type !== "image") return;
      if (!allowImages && item.type === "image" && !isFrameContainer(images[item.index])) return;
      if (item.type === "stroke") {
        const st = strokes[item.index];
        if (st && canDeleteStroke(st) && isStrokeVisible(st)) strokeIds.add(st.id);
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          const st = strokes[idx];
          if (st && canDeleteStroke(st) && isStrokeVisible(st)) strokeIds.add(st.id);
        });
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t && canDeleteText(t) && isTextVisible(t)) textIds.add(t.id);
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img && (allowImages || isFrameContainer(img)) && canInteractImage(img)) {
          if (isDraftBoardImage(img)) {
            addDraftBoardContentsToDeleteSets(img, strokeIds, textIds, imageIds, draftIds);
          }
          if (isFrameContainer(img) && frameDeleteMode === "with-contents") {
            addFrameContentsToDeleteSets(img, strokeIds, textIds, imageIds, draftIds);
          } else if (isFrameContainer(img) && frameDeleteMode === "frame-only") {
            detachFrameContents(img);
          }
          imageIds.add(img.id);
        }
      } else if (item.type === "link") {
        const link = links[item.index];
        if (link && canInteractLink(link)) linkIds.add(link.id);
      } else if (item.type === "draft") {
        const d = draftStrokes[item.index];
        if (d && canDeleteDraft(d) && d.user === currentUser) draftIds.add(d.id);
      } else if (item.type === "draft-group") {
        item.indices.forEach((idx) => {
          const d = draftStrokes[idx];
          if (d && canDeleteDraft(d) && d.user === currentUser) draftIds.add(d.id);
        });
      }
    };

    if (multiSelection && multiSelection.items) {
      multiSelection.items.forEach(collect);
    } else if (selected) {
      collect(selected);
    }

    if (!strokeIds.size && !textIds.size && !imageIds.size && !linkIds.size && !draftIds.size) return;

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
        invalidatePendingImageLoad(removed?.id);
        if (removed && socketConnected) {
          socket.emit("item:remove", { boardId, type: "image", id });
        }
      } else {
        invalidatePendingImageLoad(id);
      }
    });

    linkIds.forEach((id) => {
      const idx = findIndexById(links, id);
      if (idx >= 0) {
        links.splice(idx, 1);
        if (socketConnected) {
          socket.emit("item:remove", { boardId, type: "link", id });
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

    if (textIds.size) refreshTextList();
    if (imageIds.size) refreshImageList();
    if (linkIds.size) refreshLinkList();
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
      } else if (item.type === "link") {
        addBounds(getLinkBoundsWorld(links[item.index]));
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

  function applyStoredImagePatch(id, storedImage) {
    if (!id || !storedImage?.src) return;
    const idx = findIndexById(images, id);
    if (idx < 0) return;
    const current = images[idx];
    if (current.src === storedImage.src) return;
    invalidatePendingImageLoad(id);
    images[idx] = { ...current, ...storedImage, img: null, renderImg: null };
    ensureImageElementForImage(images[idx], { redrawOnLoad: true });
    refreshImageList();
    redraw();
  }

  function getSelectedTextItems() {
    return getSelectionItems()
      .filter((item) => item.type === "text")
      .map((item) => ({ item, text: texts[item.index] }))
      .filter(({ text }) => !!text);
  }

  function toggleTextWritingModeSelection() {
    const items = getSelectionItems();
    if (!items.length || items.some((item) => item.type !== "text")) return false;
    const textItems = getSelectedTextItems();
    if (!textItems.length) return false;
    ensureSnapshotForAction();
    textItems.forEach(({ text }) => {
      text.vertical = !text.vertical;
      text.rotation = 0;
      emitItemPatch("text", text, { vertical: text.vertical, rotation: text.rotation });
    });
    refreshTextList();
    redraw();
    return true;
  }

  function handleAltSelectionAction(direction) {
    if (toggleTextWritingModeSelection()) return true;
    if (toggleOmoteUraOrientationSelection()) return true;
    return rotateSelection(direction);
  }

  function toggleOmoteUraOrientationSelection() {
    const items = getSelectionItems();
    const targets = items
      .filter((item) => item.type === "image")
      .map((item) => images[item.index])
      .filter((img) => isOmoteUraTagImage(img));
    if (!targets.length || targets.length !== items.length) return false;
    ensureSnapshotForAction();
    targets.forEach((img) => {
      img.tagType = "omoteura";
      img.tagLabel = getOmoteUraOrientation(img) === "horizontal" ? "vertical" : "horizontal";
      refreshFrameImageForCurrentSize(img, { emit: true });
    });
    redraw();
    return true;
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
        if (!img || isFrameContainer(img) || isBoardOverlayImage(img)) return;
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

  function getObjectOrderValue(type, obj, fallback = 0) {
    if (!obj) return fallback;
    return typeof obj.order === "number" ? obj.order : fallback;
  }

  function getFrameOrder(frameImg) {
    return getObjectOrderValue("image", frameImg, 0);
  }

  function getMaxGlobalOrder() {
    const orders = [];
    strokes.forEach((s) => s && orders.push(getObjectOrderValue("stroke", s, 0)));
    texts.forEach((t) => t && orders.push(getObjectOrderValue("text", t, 0)));
    images.forEach((img) => img && orders.push(getObjectOrderValue("image", img, 0)));
    draftStrokes.forEach((s) => s && orders.push(getObjectOrderValue("draft", s, 0)));
    return orders.length ? Math.max(...orders) : 0;
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

    const targetKeys = new Set(targets.map((it) => getSelectionItemKey(it)));
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

      const otherLayerItems = layerItems.filter((it) => !targetKeys.has(getSelectionItemKey(it)));
      const orders = (otherLayerItems.length ? otherLayerItems : layerItems).map((x) => x.order ?? 0);
      const maxOrder = Math.max(...orders);
      const minOrder = Math.min(...orders);

      if (direction === "front") {
        orderedTargets.forEach((it, idx) => {
          setItemOrder(it, maxOrder + idx + 1);
        });
      } else if (direction === "back") {
        orderedTargets.forEach((it, idx) => {
          setItemOrder(it, minOrder - orderedTargets.length + idx);
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
    const clonedDraftIds = new Set();
    const clonedImageIds = new Set();
    const clonedTextIds = new Set();
    const clonedGroupIds = new Map();
    const getCloneGroupId = (groupId) => {
      if (!groupId) return null;
      if (!clonedGroupIds.has(groupId)) clonedGroupIds.set(groupId, genId());
      return clonedGroupIds.get(groupId);
    };
    const duplicatedImageNames = new Map();
    const getDuplicateImageName = (name) => {
      const baseName = (name || "").trim();
      if (!baseName) return "";
      const match = baseName.match(/^(.*?)(?:\((\d+)\))?$/);
      const root = (match?.[1] || baseName).trim() || baseName;
      const used = new Set(images.map((img) => (img.imageName || "").trim()).filter(Boolean));
      const start = Math.max(2, duplicatedImageNames.get(root) || 2);
      let n = start;
      while (used.has(`${root}(${n})`)) n += 1;
      duplicatedImageNames.set(root, n + 1);
      return `${root}(${n})`;
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
      emitStrokeAdd(clone);
    };
    const cloneFrameStroke = (s, idxOffset = 1, targetFrameId = null) => {
      if (!s || clonedStrokeIds.has(s.id)) return;
      const clone = {
        ...s,
        id: genId(),
        groupId: getCloneGroupId(s.groupId),
        points: s.points.map((p) => ({ x: p.x + offset * idxOffset, y: p.y + offset * idxOffset })),
        order: orderCounter++,
        frameId: targetFrameId || s.frameId || null,
        user: currentUser,
      };
      strokes.push(clone);
      clonedStrokeIds.add(s.id);
      emitStrokeAdd(clone);
    };
    const cloneFrameDraft = (s, idxOffset = 1, targetFrameId = null) => {
      if (!s || clonedDraftIds.has(s.id)) return;
      const clone = {
        ...s,
        id: genId(),
        groupId: getCloneGroupId(s.groupId),
        points: s.points.map((p) => ({ x: p.x + offset * idxOffset, y: p.y + offset * idxOffset })),
        order: draftOrderCounter++,
        frameId: targetFrameId || s.frameId || null,
        user: currentUser,
      };
      draftStrokes.push(clone);
      clonedDraftIds.add(s.id);
      if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: clone });
    };
    const cloneFrameText = (t, idxOffset = 1, targetFrameId = null) => {
      if (!t || clonedTextIds.has(t.id)) return;
      const clone = {
        ...t,
        id: genId(),
        x: t.x + offset * idxOffset,
        y: t.y + offset * idxOffset,
        order: orderCounter++,
        textListOrder: bumpTextListOrderCounter(),
        frameId: targetFrameId || t.frameId || null,
        user: currentUser,
      };
      texts.push(clone);
      clonedTextIds.add(t.id);
      refreshTextList();
      emitTextAdd(clone);
    };
    const cloneFrameImage = (imgObj, idxOffset = 1, targetFrameId = null) => {
      if (!imgObj || clonedImageIds.has(imgObj.id)) return null;
      const clone = {
        ...imgObj,
        id: genId(),
        x: imgObj.x + offset * idxOffset,
        y: imgObj.y + offset * idxOffset,
        order: orderCounter++,
        imageName: getDuplicateImageName(imgObj.imageName),
        imageListOrder: bumpImageListOrderCounter(),
        frameId: isFrameContainer(imgObj) ? null : targetFrameId || imgObj.frameId || null,
        frameTabs: imgObj.frameTabs ? imgObj.frameTabs.map((tab) => ({ ...tab })) : imgObj.frameTabs,
        user: currentUser,
      };
      images.push(clone);
      clonedImageIds.add(imgObj.id);
      refreshImageList();
      emitImageAdd(clone);
      return clone;
    };
    const duplicateFrameWithContents = (frameImg, idxOffset = 1) => {
      const contents = getFrameContentItems(frameImg);
      const frameClone = cloneFrameImage(frameImg, idxOffset);
      if (!frameClone) return;
      contents.forEach((content) => {
        if (content.type === "stroke") cloneFrameStroke(strokes[content.index], idxOffset, frameClone.id);
        else if (content.type === "draft") cloneFrameDraft(draftStrokes[content.index], idxOffset, frameClone.id);
        else if (content.type === "text") cloneFrameText(texts[content.index], idxOffset, frameClone.id);
        else if (content.type === "image") cloneFrameImage(images[content.index], idxOffset, frameClone.id);
      });
    };

    items.forEach((item, idx) => {
      if (item.type === "image") {
        const imgObj = images[item.index];
        if (!imgObj) return;
        if (!allowImages && !isFrameContainer(imgObj)) return;
        if (!canInteractImage(imgObj)) return;
        if (isFrameContainer(imgObj)) {
          duplicateFrameWithContents(imgObj, idx + 1);
          return;
        }
        const clone = {
          ...imgObj,
          id: genId(),
          x: imgObj.x + offset * (idx + 1) * 0.5,
          y: imgObj.y + offset * (idx + 1) * 0.5,
          order: orderCounter++,
          imageName: getDuplicateImageName(imgObj.imageName),
          imageListOrder: bumpImageListOrderCounter(),
          user: currentUser,
        };
        images.push(clone);
        clonedImageIds.add(imgObj.id);
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
          textListOrder: bumpTextListOrderCounter(),
          user: currentUser,
        };
        texts.push(clone);
        refreshTextList();
        emitTextAdd(clone);
      }
    });
    redraw();
  }

  function getImageBoundsWorld(img) {
    if (!img) return null;
    return { x: img.x, y: img.y, width: img.width, height: img.height };
  }

  function isLinkedBoardImage(imgObj) {
    return !!imgObj?.linkBoardSource;
  }

  function isDraftBoardImage(imgObj) {
    return !!imgObj?.draftBoardSource;
  }

  function isBoardOverlayImage(imgObj) {
    return isLinkedBoardImage(imgObj) || isDraftBoardImage(imgObj);
  }

  function isLassoToolObject(imgObj) {
    return !!imgObj?.lassoToolObject || isDraftBoardImage(imgObj) || isLinkedBoardImage(imgObj);
  }

  function normalizeWorldRectFromPoints(a, b) {
    return getNormalizedRect({
      x: a.x,
      y: a.y,
      width: b.x - a.x,
      height: b.y - a.y,
    });
  }

  function getLinkedBoardAtWorldPoint(worldPoint) {
    let best = null;
    images.forEach((img, index) => {
      if (!isLinkedBoardImage(img) || !isImageVisible(img)) return;
      if (!pointInRectWorld(getImageBoundsWorld(img), worldPoint)) return;
      const order = getObjectOrderValue("image", img, index);
      if (!best || order >= best.order) best = { img, index, order };
    });
    return best;
  }

  function getDraftBoardAtWorldPoint(worldPoint) {
    let best = null;
    images.forEach((img, index) => {
      if (!isDraftBoardImage(img) || !isImageVisible(img) || img.user !== currentUser) return;
      if (!pointInRectWorld(getImageBoundsWorld(img), worldPoint)) return;
      const order = getObjectOrderValue("image", img, index);
      if (!best || order >= best.order) best = { img, index, order };
    });
    return best;
  }

  function mapLinkedBoardWorldToSource(imgObj, worldPoint) {
    const src = imgObj?.linkBoardSource;
    if (!src || !imgObj?.width || !imgObj?.height) return worldPoint;
    return {
      x: src.x + ((worldPoint.x - imgObj.x) / imgObj.width) * src.width,
      y: src.y + ((worldPoint.y - imgObj.y) / imgObj.height) * src.height,
    };
  }

  function getLinkedBoardLabelBoundsScreen(imgObj) {
    if (!isLinkedBoardImage(imgObj)) return null;
    const p = worldToScreen(imgObj.x, imgObj.y);
    return { x: p.x + 6, y: p.y + 4, width: 48, height: 24 };
  }

  function hitTestLinkedBoardLabel(screenX, screenY) {
    const point = { x: screenX, y: screenY };
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (!isLinkedBoardImage(img) || !isImageVisible(img) || !canInteractImage(img)) continue;
      const bounds = getLinkedBoardLabelBoundsScreen(img);
      if (bounds && pointInScreenRect(point, bounds)) return { img, index: i };
    }
    return null;
  }

  function focusLinkedBoardSource(imgObj) {
    const src = imgObj?.linkBoardSource;
    if (!src || !src.width || !src.height) return;
    offsetX = canvas.width / 2 - (src.x + src.width / 2) * scale;
    offsetY = canvas.height / 2 - (src.y + src.height / 2) * scale;
    selected = null;
    multiSelection = null;
    currentTool = "select";
    updateToolButtons();
    updateFooterByState();
    redraw();
  }

  function startImageDragAtCanvasPoint(imgIndex, canvasPos, options = {}) {
    if (options.snapshot !== false) ensureSnapshotForAction();
    selected = { type: "image", index: imgIndex };
    multiSelection = null;
    const imgObj = images[imgIndex];
    if (isFrameContainer(imgObj)) bringFrameGroupToFront(imgObj);
    frameDragOffsets = isFrameContainer(imgObj) ? captureFrameDragItems(imgObj) : null;
    draftBoardDragOffsets = isDraftBoardImage(imgObj) ? captureDraftBoardDragItems(imgObj) : null;
    const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
    dragOffsetWorld = {
      x: worldPos.x - imgObj.x,
      y: worldPos.y - imgObj.y,
    };
    isDraggingObject = true;
    redraw();
  }

  function getVisibleWorldRect(marginScreen = 256) {
    const margin = marginScreen / Math.max(scale, 0.001);
    return {
      x: -offsetX / scale - margin,
      y: -offsetY / scale - margin,
      width: canvas.width / scale + margin * 2,
      height: canvas.height / scale + margin * 2,
    };
  }

  function isWorldRectNearViewport(rect, marginScreen = 256) {
    if (!rect) return false;
    return rectsOverlap(getVisibleWorldRect(marginScreen), getNormalizedRect(rect));
  }

  function isImageNearViewport(imgObj, marginScreen = 512) {
    if (!imgObj) return false;
    if (imgObj.frameId) {
      const owner = getFrameById(imgObj.frameId);
      return owner ? isWorldRectNearViewport(getRotatedImageVisualBoundsWorld(owner), marginScreen) : true;
    }
    return isWorldRectNearViewport(getRotatedImageVisualBoundsWorld(imgObj), marginScreen);
  }

  function isFramedObjectNearViewport(obj, fallbackItem = null, marginScreen = 512) {
    if (!obj) return false;
    if (obj.frameId) {
      const owner = getFrameById(obj.frameId);
      return owner ? isWorldRectNearViewport(getRotatedImageVisualBoundsWorld(owner), marginScreen) : true;
    }
    const owner = fallbackItem ? findOwningFrameForItem(fallbackItem) : null;
    if (owner?.frame) return isWorldRectNearViewport(getRotatedImageVisualBoundsWorld(owner.frame), marginScreen);
    const bounds = fallbackItem ? getBoundsForFrameContentCandidate(fallbackItem) : null;
    return bounds ? isWorldRectNearViewport(bounds, marginScreen) : true;
  }

  function ensureImageElementForImage(imgObj, options = {}) {
    if (!imgObj?.id || !imgObj.src) return null;
    if (imgObj.img?.complete && imgObj.img.naturalWidth > 0 && imgObj.img.naturalHeight > 0) {
      if (!imgObj.renderImg) imgObj.renderImg = createImageRenderSource(imgObj.img);
      return imgObj.img;
    }

    const cached = imageElementCache.get(imgObj.id);
    if (cached?.src === imgObj.src && cached.img) {
      imgObj.img = cached.img;
      imgObj.renderImg = cached.renderImg || createImageRenderSource(cached.img);
      return imgObj.img;
    }

    if (pendingImageLoadTokens.has(imgObj.id)) return imgObj.img || null;

    const loadToken = ++imageLoadTokenCounter;
    const img = imgObj.img || new Image();
    imgObj.img = img;
    pendingImageLoadTokens.set(imgObj.id, loadToken);
    img.onload = () => {
      if (pendingImageLoadTokens.get(imgObj.id) !== loadToken) return;
      pendingImageLoadTokens.delete(imgObj.id);
      imgObj.renderImg = createImageRenderSource(img);
      imageElementCache.set(imgObj.id, { src: imgObj.src, img, renderImg: imgObj.renderImg });
      if (options.redrawOnLoad !== false) redraw();
    };
    img.onerror = () => {
      if (pendingImageLoadTokens.get(imgObj.id) !== loadToken) return;
      pendingImageLoadTokens.delete(imgObj.id);
      console.error("failed to load image", imgObj?.id);
    };
    img.src = imgObj.src;
    return img;
  }

  function createImageRenderSource(imgEl) {
    const maxSide = 1200;
    const width = imgEl?.naturalWidth || imgEl?.width || 0;
    const height = imgEl?.naturalHeight || imgEl?.height || 0;
    if (!width || !height || Math.max(width, height) <= maxSide) return imgEl;
    const ratio = maxSide / Math.max(width, height);
    const canvasEl = document.createElement("canvas");
    canvasEl.width = Math.max(1, Math.round(width * ratio));
    canvasEl.height = Math.max(1, Math.round(height * ratio));
    const canvasCtx = canvasEl.getContext("2d");
    canvasCtx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
    return canvasEl;
  }

  function getRotatedImageVisualBoundsWorld(imgObj) {
    const bounds = getImageBoundsWorld(imgObj);
    if (!bounds) return null;
    const rotation = normalizeRotation(imgObj.rotation || 0);
    if (!rotation) return bounds;
    return getAxisAlignedBoundsFromPoints(getRotatedRectCornersWorld(bounds, rotation));
  }

  function isFrameContainer(imgObj) {
    return !!imgObj?.tagType && imgObj.tagType !== "omoteura";
  }

  function isOmoteUraTagImage(imgObj) {
    return (
      imgObj?.tagType === "omoteura" ||
      (!imgObj?.tagType && imgObj?.tagLabel === "表裏")
    );
  }

  function getOmoteUraOrientation(imgObj) {
    return imgObj?.tagLabel === "horizontal" ? "horizontal" : "vertical";
  }

  function getFrameImagesForGrouping() {
    if (frameRenderCache?.framesForGrouping) return frameRenderCache.framesForGrouping;
    return images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => isFrameContainer(img))
      .sort((a, b) => getFrameOrder(a.img) - getFrameOrder(b.img));
  }

  function getFrameById(frameId) {
    if (!frameId) return null;
    if (frameRenderCache?.frameById) return frameRenderCache.frameById.get(frameId) || null;
    return images.find((img) => img?.id === frameId && isFrameContainer(img)) || null;
  }

  function getFrameIndexById(frameId) {
    if (!frameId) return -1;
    if (frameRenderCache?.frameIndexById) return frameRenderCache.frameIndexById.get(frameId) ?? -1;
    return images.findIndex((img) => img?.id === frameId && isFrameContainer(img));
  }

  function createFrameRenderCache() {
    const framesForGrouping = images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => isFrameContainer(img))
      .sort((a, b) => getFrameOrder(a.img) - getFrameOrder(b.img));
    const frameById = new Map();
    const frameIndexById = new Map();
    const frameContentById = new Map();
    framesForGrouping.forEach(({ img, index }) => {
      if (!img?.id) return;
      frameById.set(img.id, img);
      frameIndexById.set(img.id, index);
      frameContentById.set(img.id, []);
    });
    const ownerByItemKey = new Map();
    const addIndexedItem = (type, index, obj) => {
      if (!obj?.frameId || !frameById.has(obj.frameId)) return;
      const frame = frameById.get(obj.frameId);
      const item = { type, index };
      const owner = { frame, index: frameIndexById.get(obj.frameId) ?? -1, order: getFrameOrder(frame) };
      ownerByItemKey.set(`${type}:${index}`, owner);
      const list = frameContentById.get(obj.frameId) || [];
      list.push(item);
      frameContentById.set(obj.frameId, list);
    };
    strokes.forEach((obj, index) => addIndexedItem("stroke", index, obj));
    draftStrokes.forEach((obj, index) => addIndexedItem("draft", index, obj));
    texts.forEach((obj, index) => addIndexedItem("text", index, obj));
    images.forEach((obj, index) => {
      if (isFrameContainer(obj)) return;
      addIndexedItem("image", index, obj);
    });
    return {
      framesForGrouping,
      frameById,
      frameIndexById,
      ownerByItemKey,
      frameContentById,
    };
  }

  function getFrameMembershipTabForObject(frame, obj) {
    if (!isFrameContainer(frame)) return null;
    return getFrameCurrentTargetTab(frame);
  }

  function getFrameMembershipAtWorldPoint(worldPoint, obj = null) {
    if (!worldPoint) return null;
    let owner = null;
    getFrameImagesForGrouping().forEach(({ img }) => {
      const bounds = getImageBoundsWorld(img);
      if (!bounds || !pointInRectWorld(bounds, worldPoint)) return;
      const order = getFrameOrder(img);
      if (!owner || order > owner.order) owner = { frame: img, order };
    });
    if (!owner) return null;
    return {
      frameId: owner.frame.id,
      frameTab: getFrameMembershipTabForObject(owner.frame, obj),
    };
  }

  function getFrameMembershipForBounds(bounds, excludeImageId = null, obj = null) {
    if (!bounds) return null;
    let owner = null;
    getFrameImagesForGrouping().forEach(({ img }) => {
      if (excludeImageId && img.id === excludeImageId) return;
      const frameBounds = getImageBoundsWorld(img);
      if (!frameBounds || !rectContainsRect(frameBounds, bounds)) return;
      const order = getFrameOrder(img);
      if (!owner || order > owner.order) owner = { frame: img, order };
    });
    if (!owner) return null;
    return {
      frameId: owner.frame.id,
      frameTab: getFrameMembershipTabForObject(owner.frame, obj),
    };
  }

  function getBackOrderForFrameContainingExistingFrames(frameImg) {
    if (!isFrameContainer(frameImg)) return null;
    const frameBounds = getImageBoundsWorld(frameImg);
    if (!frameBounds) return null;
    const containedOrders = getFrameImagesForGrouping()
      .filter(({ img }) => {
        if (!img || img.id === frameImg.id) return false;
        const bounds = getImageBoundsWorld(img);
        return bounds && rectContainsRect(frameBounds, bounds);
      })
      .map(({ img }) => getFrameOrder(img))
      .filter((order) => typeof order === "number");
    if (!containedOrders.length) return null;
    return Math.min(...containedOrders) - 1;
  }

  function getBackOrderBehindOverlappingImages(imgObj) {
    const bounds = getImageBoundsWorld(imgObj);
    if (!bounds) return null;
    const overlappingOrders = images
      .filter((img) => {
        if (!img || img.id === imgObj.id || isFrameContainer(img) || isOmoteUraTagImage(img)) return false;
        const imageBounds = getImageBoundsWorld(img);
        return imageBounds && rectsOverlap(bounds, imageBounds);
      })
      .map((img) => getObjectOrderValue("image", img, 0))
      .filter((order) => typeof order === "number");
    if (!overlappingOrders.length) return null;
    return Math.min(...overlappingOrders) - 1;
  }

  function applyFrameMembershipByPoint(obj, worldPoint) {
    const membership = getFrameMembershipAtWorldPoint(worldPoint, obj);
    if (!membership) return obj;
    obj.frameId = membership.frameId;
    obj.frameTab = membership.frameTab;
    return obj;
  }

  function updateFrameMembershipForItem(item) {
    if (!item) return null;
    const obj =
      item.type === "stroke"
        ? strokes[item.index]
        : item.type === "draft"
        ? draftStrokes[item.index]
        : item.type === "text"
        ? texts[item.index]
        : item.type === "image"
        ? images[item.index]
        : null;
    if (!obj) return null;
    const bounds = getBoundsForFrameContentCandidate(item);
    const membership = getFrameMembershipForBounds(
      bounds,
      item.type === "image" ? obj.id : null,
      obj
    );
    const nextFrameId = membership?.frameId || null;
    const nextFrameTab = membership?.frameTab || null;
    if ((obj.frameId || null) === nextFrameId && (obj.frameTab || null) === nextFrameTab) return null;
    obj.frameId = nextFrameId;
    obj.frameTab = nextFrameTab;
    return { frameId: nextFrameId, frameTab: nextFrameTab };
  }

  function isFrameVisibleInAncestorTabs(frameImg, seenFrameIds = new Set()) {
    if (!isFrameContainer(frameImg)) return false;
    if (!frameImg.frameId) return true;
    if (seenFrameIds.has(frameImg.id)) return false;
    seenFrameIds.add(frameImg.id);

    const parentFrame = getFrameById(frameImg.frameId);
    if (!parentFrame || !isImageVisible(parentFrame)) return false;
    if (!isFrameVisibleInAncestorTabs(parentFrame, seenFrameIds)) return false;

    const tab = frameImg.frameTab || getFrameActiveTab(parentFrame);
    return tab === "background" || tab === getFrameActiveTab(parentFrame);
  }

  function isFrameMemberVisible(obj, fallbackItem = null) {
    if (!obj) return false;
    if (obj.frameId) {
      const frame = getFrameById(obj.frameId);
      if (!frame || !isImageVisible(frame)) return false;
      if (!isFrameVisibleInAncestorTabs(frame)) return false;
      const tab = obj.frameTab || getFrameActiveTab(frame);
      return tab === "background" || tab === getFrameActiveTab(frame);
    }
    if (fallbackItem) {
      const owner = findOwningFrameForItem(fallbackItem);
      if (owner) return owner.frame.activeFrameTab !== "background" && isFrameVisibleInAncestorTabs(owner.frame);
    }
    if (obj.tagType) return true;
    return true;
  }

  function getFrameMemberDrawRank(obj) {
    if (!obj) return 0;
    if (obj.tagType) return 2;
    return obj.frameTab === "background" ? 1 : 3;
  }

  function getBoundsForFrameContentCandidate(item) {
    if (!item) return null;
    if (item.type === "stroke") return getStrokeBoundsWorld(strokes[item.index]);
    if (item.type === "draft") return getStrokeBoundsWorld(draftStrokes[item.index]);
    if (item.type === "text") return getTextBoundsWorld(texts[item.index]);
    if (item.type === "image") return getImageBoundsWorld(images[item.index]);
    return null;
  }

  function getOrderForFrameContentCandidate(item) {
    if (!item) return 0;
    if (item.type === "stroke") return getObjectOrderValue("stroke", strokes[item.index], 0);
    if (item.type === "draft") return getObjectOrderValue("draft", draftStrokes[item.index], 0);
    if (item.type === "text") return getObjectOrderValue("text", texts[item.index], 0);
    if (item.type === "image") return getObjectOrderValue("image", images[item.index], 0);
    return 0;
  }

  function findOwningFrameForItem(item) {
    const cacheKey = item ? `${item.type}:${item.index}` : "";
    if (cacheKey && frameRenderCache?.ownerByItemKey?.has(cacheKey)) {
      return frameRenderCache.ownerByItemKey.get(cacheKey);
    }
    const bounds = getBoundsForFrameContentCandidate(item);
    if (!bounds) return null;

    const storedFrameId =
      item?.type === "stroke"
        ? strokes[item.index]?.frameId
        : item?.type === "draft"
        ? draftStrokes[item.index]?.frameId
        : item?.type === "text"
        ? texts[item.index]?.frameId
        : item?.type === "image"
        ? images[item.index]?.frameId
        : null;
    if (storedFrameId) {
      const frame = getFrameById(storedFrameId);
      if (frame) {
        const owner = { frame, index: getFrameIndexById(frame.id), order: getFrameOrder(frame) };
        if (cacheKey && frameRenderCache?.ownerByItemKey) frameRenderCache.ownerByItemKey.set(cacheKey, owner);
        return owner;
      }
    }

    const itemOrder = getOrderForFrameContentCandidate(item);
    let owner = null;
    getFrameImagesForGrouping().forEach(({ img, index }) => {
      if (item.type === "image" && images[item.index]?.id === img.id) return;
      const frameOrder = getFrameOrder(img);
      if (frameOrder >= itemOrder) return;
      const frameBounds = getImageBoundsWorld(img);
      if (!frameBounds || !rectContainsRect(frameBounds, bounds)) return;
      if (!owner || frameOrder > owner.order) {
        owner = { frame: img, index, order: frameOrder };
      }
    });
    if (cacheKey && frameRenderCache?.ownerByItemKey) frameRenderCache.ownerByItemKey.set(cacheKey, owner);
    return owner;
  }

  function findOwningOmoteUraFrameForImage(imgObj) {
    if (!imgObj || isFrameContainer(imgObj) || isOmoteUraTagImage(imgObj)) return null;
    const bounds = getImageBoundsWorld(imgObj);
    if (!bounds) return null;
    let owner = null;
    images.forEach((frame, index) => {
      if (!isOmoteUraTagImage(frame) || !isImageVisible(frame)) return;
      const frameBounds = getImageBoundsWorld(frame);
      if (!frameBounds || !rectContainsRect(frameBounds, bounds)) return;
      const order = getObjectOrderValue("image", frame, index);
      if (!owner || order > owner.order) owner = { frame, index, order };
    });
    return owner;
  }

  function getFrameContentItems(frameImg) {
    if (!isFrameContainer(frameImg)) return [];
    if (frameRenderCache?.frameContentById?.has(frameImg.id)) {
      return frameRenderCache.frameContentById.get(frameImg.id);
    }
    const frameBounds = getImageBoundsWorld(frameImg);
    if (!frameBounds) return [];
    const items = [];

    strokes.forEach((s, index) => {
      const owner = findOwningFrameForItem({ type: "stroke", index });
      if (owner?.frame?.id === frameImg.id) {
        items.push({ type: "stroke", index });
      }
    });
    texts.forEach((t, index) => {
      const owner = findOwningFrameForItem({ type: "text", index });
      if (owner?.frame?.id === frameImg.id) {
        items.push({ type: "text", index });
      }
    });
    images.forEach((img, index) => {
      if (!img || img.id === frameImg.id) return;
      const owner = findOwningFrameForItem({ type: "image", index });
      if (owner?.frame?.id === frameImg.id) {
        items.push({ type: "image", index });
      }
    });
    draftStrokes.forEach((s, index) => {
      if (!s) return;
      const owner = findOwningFrameForItem({ type: "draft", index });
      if (owner?.frame?.id === frameImg.id) {
        items.push({ type: "draft", index });
      }
    });

    if (frameRenderCache?.frameContentById) {
      frameRenderCache.frameContentById.set(frameImg.id, items);
    }
    return items;
  }

  function getFrameViewportWorld(frameImg) {
    if (!isFrameContainer(frameImg)) return null;
    const headerH = Math.min(getFrameHeaderHeightWorld(frameImg), frameImg.height);
    return {
      x: frameImg.x,
      y: frameImg.y + headerH,
      width: Math.max(0, frameImg.width),
      height: Math.max(0, frameImg.height - headerH),
    };
  }

  function pointInScreenRect(point, rect) {
    return (
      rect &&
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function inflateScreenRect(rect, padding) {
    if (!rect) return null;
    return {
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
  }

  function getFrameRenderClipForItem(item) {
    if (!item?.frameGroupId || item.frameGroupRank === 0) return null;
    const frame = getFrameById(item.frameGroupId);
    if (!frame) return null;
    const viewport = getFrameViewportWorld(frame);
    if (!viewport) return null;
    return { viewport };
  }

  function getFrameRenderClipChainForItem(item) {
    if (!item?.frameGroupId || item.frameGroupRank === 0) return [];
    return getFrameRenderClipChainFromFrameId(item.frameGroupId);
  }

  function getFrameRenderClipChainFromFrameId(frameId) {
    if (!frameId) return [];
    const clips = [];
    const seen = new Set();
    let frame = getFrameById(frameId);
    while (frame && !seen.has(frame.id)) {
      seen.add(frame.id);
      const viewport = getFrameViewportWorld(frame);
      if (viewport) {
        clips.push({ viewport });
      }
      frame = frame.frameId ? getFrameById(frame.frameId) : null;
    }
    return clips.reverse();
  }

  function captureFrameDragItems(frameImg) {
    if (!isFrameContainer(frameImg)) return null;
    const captured = {
      frameId: frameImg.id,
      frameX: frameImg.x,
      frameY: frameImg.y,
      items: [],
    };
    getFrameContentItemsDeep(frameImg).forEach((item) => {
      if (item.type === "stroke") {
        const s = strokes[item.index];
        if (s) {
          captured.items.push({
            type: "stroke",
            index: item.index,
            points: s.points.map((p) => ({ x: p.x, y: p.y })),
          });
        }
      } else if (item.type === "draft") {
        const s = draftStrokes[item.index];
        if (s) {
          captured.items.push({
            type: "draft",
            index: item.index,
            points: s.points.map((p) => ({ x: p.x, y: p.y })),
          });
        }
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (t) captured.items.push({ type: "text", index: item.index, x: t.x, y: t.y });
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img) captured.items.push({ type: "image", index: item.index, x: img.x, y: img.y });
      }
    });
    return captured.items.length ? captured : null;
  }

  function applyFrameDragOffsets(captured, dx, dy) {
    if (!captured) return;
    captured.items.forEach((it) => {
      if (it.type === "stroke") {
        const s = strokes[it.index];
        if (s) s.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else if (it.type === "draft") {
        const s = draftStrokes[it.index];
        if (s) s.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else if (it.type === "text") {
        const t = texts[it.index];
        if (t) {
          t.x = it.x + dx;
          t.y = it.y + dy;
        }
      } else if (it.type === "image") {
        const img = images[it.index];
        if (img) {
          img.x = it.x + dx;
          img.y = it.y + dy;
        }
      }
    });
  }

  function emitFrameDragUpdates(captured) {
    if (!socketConnected || !captured) return;
    captured.items.forEach((it) => {
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
      } else if (it.type === "draft") {
        const s = draftStrokes[it.index];
        if (s) socket.emit("draft:stroke:add", { boardId, stroke: s });
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
      }
    });
  }

  function captureDraftBoardDragItems(boardImg) {
    if (!isDraftBoardImage(boardImg)) return null;
    const boardId = boardImg.id;
    const captured = { boardId, boardX: boardImg.x, boardY: boardImg.y, items: [] };
    draftStrokes.forEach((stroke, index) => {
      if (stroke?.draftBoardId !== boardId) return;
      captured.items.push({
        type: "draft",
        index,
        id: stroke.id,
        points: (stroke.points || []).map((p) => ({ x: p.x, y: p.y })),
      });
    });
    texts.forEach((text, index) => {
      if (text?.draftBoardId !== boardId) return;
      captured.items.push({ type: "text", index, id: text.id, x: text.x, y: text.y });
    });
    images.forEach((img, index) => {
      if (!img || img.id === boardId || img.draftBoardId !== boardId) return;
      captured.items.push({ type: "image", index, id: img.id, x: img.x, y: img.y });
    });
    return captured.items.length ? captured : null;
  }

  function applyDraftBoardDragOffsets(captured, dx, dy) {
    if (!captured) return;
    captured.items.forEach((it) => {
      if (it.type === "draft") {
        const stroke = draftStrokes[it.index];
        if (stroke && stroke.id === it.id) {
          stroke.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
      } else if (it.type === "text") {
        const text = texts[it.index];
        if (text && text.id === it.id) {
          text.x = it.x + dx;
          text.y = it.y + dy;
        }
      } else if (it.type === "image") {
        const img = images[it.index];
        if (img && img.id === it.id) {
          img.x = it.x + dx;
          img.y = it.y + dy;
        }
      }
    });
  }

  function emitDraftBoardDragUpdates(captured) {
    if (!socketConnected || !captured) return;
    captured.items.forEach((it) => {
      if (it.type === "draft") {
        const stroke = draftStrokes[it.index];
        if (stroke && stroke.id === it.id) socket.emit("draft:stroke:add", { boardId, stroke });
      } else if (it.type === "text") {
        const text = texts[it.index];
        if (!text || text.id !== it.id) return;
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: text.id,
          patch: { x: text.x, y: text.y },
        });
      } else if (it.type === "image") {
        const img = images[it.index];
        if (!img || img.id !== it.id) return;
        socket.emit("item:update", {
          boardId,
          type: "image",
          id: img.id,
          patch: { x: img.x, y: img.y },
        });
      }
    });
  }

  function setFrameGroupedItemOrder(item, newOrder) {
    if (!item || typeof newOrder !== "number") return;
    if (item.type === "stroke") {
      const s = strokes[item.index];
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
    } else if (item.type === "draft") {
      const s = draftStrokes[item.index];
      if (!s) return;
      s.order = newOrder;
      bumpDraftOrderCounter(newOrder);
      if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: s });
    } else if (item.type === "text") {
      const t = texts[item.index];
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
    } else if (item.type === "image") {
      const img = images[item.index];
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

  function adoptItemIntoFrameTab(item, frameImg) {
    if (!item || !isFrameContainer(frameImg)) return;
    const frameTab = getFrameCurrentTargetTab(frameImg);
    const patch = { frameId: frameImg.id, frameTab };
    if (item.type === "stroke") {
      const s = strokes[item.index];
      if (!s || s.frameId) return;
      s.frameId = patch.frameId;
      s.frameTab = patch.frameTab;
      emitItemPatch("stroke", s, patch);
    } else if (item.type === "draft") {
      const s = draftStrokes[item.index];
      if (!s || s.frameId) return;
      s.frameId = patch.frameId;
      s.frameTab = patch.frameTab;
      if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: s });
    } else if (item.type === "text") {
      const t = texts[item.index];
      if (!t || t.frameId) return;
      t.frameId = patch.frameId;
      t.frameTab = patch.frameTab;
      emitItemPatch("text", t, patch);
    } else if (item.type === "image") {
      const img = images[item.index];
      if (!img || img.frameId) return;
      img.frameId = patch.frameId;
      img.frameTab = patch.frameTab;
      emitItemPatch("image", img, patch);
    }
  }

  function assignExistingObjectsToNewFrame(frameImg, options = {}) {
    if (!isFrameContainer(frameImg)) return;
    if (frameImg.frameId) return;
    const frameBounds = getImageBoundsWorld(frameImg);
    if (!frameBounds) return;
    const adoptLayer = options.adoptLayer || null;
    const contentTab = frameImg.frameTabs?.[0]?.id || "tab-1";
    const nestedFrameIds = new Set(
      images
        .filter((img) => {
          if (!isFrameContainer(img) || img.id === frameImg.id) return false;
          const bounds = getImageBoundsWorld(img);
          return bounds && rectContainsRect(frameBounds, bounds);
        })
        .map((img) => img.id)
    );
    const belongsToNestedFrame = (item) => {
      const owner = findOwningFrameForItem(item);
      return !!(owner?.frame?.id && nestedFrameIds.has(owner.frame.id));
    };
    const clonedGroupIds = new Map();
    const getCloneGroupId = (groupId) => {
      if (!groupId) return null;
      if (!clonedGroupIds.has(groupId)) clonedGroupIds.set(groupId, genId());
      return clonedGroupIds.get(groupId);
    };
    const copyLayer = (obj, fallback = "user") => adoptLayer || obj?.layer || fallback;
    const copyStrokeIntoFrame = (source, patch) => {
      if (!source) return;
      const clone = {
        ...source,
        id: genId(),
        groupId: getCloneGroupId(source.groupId),
        points: (source.points || []).map((p) => ({ x: p.x, y: p.y })),
        layer: copyLayer(source),
        order: orderCounter++,
        user: currentUser || source.user || "",
        frameId: patch.frameId,
        frameTab: patch.frameTab,
      };
      strokes.push(clone);
      registerUser(clone.user);
      emitStrokeAdd(clone);
    };
    const copyDraftIntoFrame = (source, patch) => {
      if (!source) return;
      const clone = {
        ...source,
        id: genId(),
        groupId: getCloneGroupId(source.groupId),
        points: (source.points || []).map((p) => ({ x: p.x, y: p.y })),
        order: draftOrderCounter++,
        user: currentUser || source.user || "",
        frameId: patch.frameId,
        frameTab: patch.frameTab,
      };
      draftStrokes.push(clone);
      registerUser(clone.user);
      if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: clone });
    };
    const copyTextIntoFrame = (source, patch) => {
      if (!source) return;
      const clone = {
        ...source,
        id: genId(),
        lines: Array.isArray(source.lines) ? source.lines.slice() : source.lines,
        layer: copyLayer(source),
        order: orderCounter++,
        user: currentUser || source.user || "",
        textListOrder: bumpTextListOrderCounter(),
        frameId: patch.frameId,
        frameTab: patch.frameTab,
      };
      texts.push(clone);
      registerUser(clone.user);
      emitTextAdd(clone);
    };
    const copyImageIntoFrame = (source, patch) => {
      if (!source) return;
      const clone = {
        ...source,
        id: genId(),
        layer: copyLayer(source, "image"),
        order: orderCounter++,
        user: currentUser || source.user || "",
        imageListOrder: bumpImageListOrderCounter(),
        frameTabs: source.frameTabs ? source.frameTabs.map((tab) => ({ ...tab })) : source.frameTabs,
        linkBoardSource: source.linkBoardSource ? { ...source.linkBoardSource } : source.linkBoardSource,
        draftBoardSource: source.draftBoardSource ? { ...source.draftBoardSource } : source.draftBoardSource,
        frameId: patch.frameId,
        frameTab: patch.frameTab,
      };
      images.push(clone);
      registerUser(clone.user);
      emitImageAdd(clone);
    };

    strokes.slice().forEach((s, index) => {
      if (belongsToNestedFrame({ type: "stroke", index })) return;
      const bounds = getBoundsForFrameContentCandidate({ type: "stroke", index });
      if (!bounds || !rectContainsRect(frameBounds, bounds)) return;
      copyStrokeIntoFrame(s, { frameId: frameImg.id, frameTab: contentTab });
    });
    texts.slice().forEach((t, index) => {
      if (belongsToNestedFrame({ type: "text", index })) return;
      const bounds = getBoundsForFrameContentCandidate({ type: "text", index });
      if (!bounds || !rectContainsRect(frameBounds, bounds)) return;
      copyTextIntoFrame(t, { frameId: frameImg.id, frameTab: contentTab });
    });
    images.slice().forEach((img, index) => {
      if (!img || img.id === frameImg.id) return;
      if (img.frameId === frameImg.id) return;
      if (belongsToNestedFrame({ type: "image", index })) return;
      const bounds = getBoundsForFrameContentCandidate({ type: "image", index });
      if (!bounds || !rectContainsRect(frameBounds, bounds)) return;
      copyImageIntoFrame(img, {
        frameId: frameImg.id,
        frameTab: isFrameContainer(img) ? contentTab : "background",
      });
    });
    draftStrokes.slice().forEach((s, index) => {
      if (belongsToNestedFrame({ type: "draft", index })) return;
      const bounds = getBoundsForFrameContentCandidate({ type: "draft", index });
      if (!bounds || !rectContainsRect(frameBounds, bounds)) return;
      copyDraftIntoFrame(s, { frameId: frameImg.id, frameTab: contentTab });
    });
    refreshTextList();
    refreshImageList();
  }

  function createCroppedFrameBackgroundImage(sourceImg, cropWorldRect, frameImg, options = {}) {
    if (!sourceImg || !sourceImg.img || !cropWorldRect || !isFrameContainer(frameImg)) return null;
    if (isFrameContainer(sourceImg)) return null;
    if (normalizeRotation(sourceImg.rotation || 0) !== 0) return null;
    const sourceEl = sourceImg.img;
    if (!sourceEl.complete || !sourceEl.naturalWidth || !sourceEl.naturalHeight) return null;
    const sourceBounds = getImageBoundsWorld(sourceImg);
    if (!sourceBounds || sourceBounds.width <= 0 || sourceBounds.height <= 0) return null;

    const scaleX = sourceEl.naturalWidth / sourceBounds.width;
    const scaleY = sourceEl.naturalHeight / sourceBounds.height;
    const sx = Math.max(0, Math.round((cropWorldRect.x - sourceBounds.x) * scaleX));
    const sy = Math.max(0, Math.round((cropWorldRect.y - sourceBounds.y) * scaleY));
    const sw = Math.min(sourceEl.naturalWidth - sx, Math.round(cropWorldRect.width * scaleX));
    const sh = Math.min(sourceEl.naturalHeight - sy, Math.round(cropWorldRect.height * scaleY));
    if (sw <= 0 || sh <= 0) return null;

    try {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, sw, sh);
      const src = cropCanvas.toDataURL("image/png");
      const img = new Image();
      const imgObj = {
        id: genId(),
        img,
        src,
        x: cropWorldRect.x,
        y: cropWorldRect.y,
        width: cropWorldRect.width,
        height: cropWorldRect.height,
        layer: options.adoptLayer || frameImg.layer || "image",
        order: orderCounter++,
        user: currentUser || sourceImg.user || "",
        rotation: 0,
        tagLabel: getCropSourceTag(sourceImg.id),
        imageName: getFrameFollowName(sourceImg.imageName),
        imageListOrder: bumpImageListOrderCounter(),
        frameId: frameImg.id,
        frameTab: "background",
      };
      img.onload = () => redraw();
      img.src = src;
      return imgObj;
    } catch (err) {
      console.error("failed to crop frame background image", err);
      return null;
    }
  }

  function addCroppedImageBackgroundsToNewFrame(frameImg, options = {}) {
    if (!isFrameContainer(frameImg) || frameImg.frameId) return 0;
    const cropTargetBounds = getFrameViewportWorld(frameImg) || getImageBoundsWorld(frameImg);
    if (!cropTargetBounds) return 0;
    const sourceImages = images.filter((img) => {
      if (!img || img.id === frameImg.id || isFrameContainer(img)) return false;
      if (img.frameId === frameImg.id) return false;
      if (!img.img || !img.src) return false;
      const bounds = getImageBoundsWorld(img);
      if (!bounds || !rectsOverlap(cropTargetBounds, bounds)) return false;
      return !rectContainsRect(cropTargetBounds, bounds);
    });
    let added = 0;
    let followName = "";
    sourceImages.forEach((sourceImg) => {
      const cropWorldRect = getRectIntersection(cropTargetBounds, getImageBoundsWorld(sourceImg));
      const cropImg = createCroppedFrameBackgroundImage(sourceImg, cropWorldRect, frameImg, options);
      if (!cropImg) return;
      if (!followName && sourceImg.imageName) followName = sourceImg.imageName;
      images.push(cropImg);
      registerUser(cropImg.user);
      emitImageAdd(cropImg);
      added += 1;
    });
    if (added) {
      if (followName) updateFrameNameFromImage(frameImg, followName);
      refreshImageList();
    }
    return added;
  }

  function hasCroppedImageBackgroundSource(targetBounds) {
    if (!targetBounds) return false;
    return images.some((img) => {
      if (!img || isFrameContainer(img)) return false;
      if (!img.img || !img.src) return false;
      const bounds = getImageBoundsWorld(img);
      if (!bounds || !rectsOverlap(targetBounds, bounds)) return false;
      return !rectContainsRect(targetBounds, bounds);
    });
  }

  function bringFrameGroupToFront(frameImg) {
    if (!isFrameContainer(frameImg)) return;
    const frameIndex = images.findIndex((img) => img?.id === frameImg.id);
    if (frameIndex < 0) return;
    const contents = getFrameContentItems(frameImg);
    contents.forEach((item) => adoptItemIntoFrameTab(item, frameImg));
    let nextOrder = getMaxGlobalOrder() + 1;
    setFrameGroupedItemOrder({ type: "image", index: frameIndex }, nextOrder++);
    contents
      .map((item) => ({ item, order: getOrderForFrameContentCandidate(item) }))
      .sort((a, b) => a.order - b.order)
      .forEach(({ item }) => {
        setFrameGroupedItemOrder(item, nextOrder++);
      });
  }

  function fillClosedStrokeAt(worldPoint) {
    if (!requireUser()) return false;
    if (!canCreateOnCurrentLayer()) return false;
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
      const fillPoints = getFillPolygonForStrokeAt(stroke, worldPoint);
      if (!fillPoints) continue;
      const area = polygonArea(fillPoints);
      if (area <= 1) continue;
      if (!target || area < target.area) {
        target = { stroke, points: fillPoints, area };
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
      points: target.points.map((p) => ({ x: p.x, y: p.y })),
      user: currentUser,
      layer: activeLayer === "draft" ? "draft" : getShapeTargetLayer(),
      order: activeLayer === "draft" ? (source.order ?? draftOrderCounter++) - 0.1 : (source.order ?? orderCounter++) - 0.1,
      createdAt: Date.now(),
      fill: true,
      groupId,
      fillSourceId: source.id,
    };
    applyCurrentGlowColor(fillStroke);
    if (source.frameId) {
      fillStroke.frameId = source.frameId;
      fillStroke.frameTab = source.frameTab || null;
    } else {
      applyFrameMembershipByPoint(fillStroke, worldPoint);
    }
    if (activeLayer === "draft") {
      draftStrokes.push(fillStroke);
    } else {
      strokes.push(fillStroke);
    }
    registerUser(currentUser);
    if (activeLayer === "draft") {
      if (socketConnected) {
        socket.emit("draft:stroke:add", { boardId, stroke: fillStroke });
      }
    } else {
      emitStrokeAdd(fillStroke);
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
        frameId: s.frameId || null,
        frameTab: s.frameTab || null,
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
          textListOrder: bumpTextListOrderCounter(),
        };
        texts.push(clone);
        copied = true;
        refreshTextList();
        emitTextAdd(clone);
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
    const items = getSelectionItems();
    const targets = items
      .flatMap((it) => {
        if (it.type === "draft") return [it.index];
        if (it.type === "draft-group") return it.indices;
        return [];
      });
    const unique = Array.from(new Set(targets))
      .map((idx) => draftStrokes[idx])
      .filter(Boolean);
    const textTargets = Array.from(
      new Set(
        items
          .filter((it) => it.type === "text")
          .map((it) => texts[it.index])
          .filter((t) => t && (t.layer || "user") === "draft" && t.user === currentUser)
          .map((t) => t.id)
      )
    )
      .map((id) => texts.find((t) => t.id === id))
      .filter(Boolean);
    if (!unique.length && !textTargets.length) return;

    const targetLayer = "user";
    ensureSnapshotForAction();

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
        frameId: draft.frameId || null,
        frameTab: draft.frameTab || null,
        glowColor: draft.glowColor || getStrokeGlowColor(draft) || null,
      };
      strokes.push(stroke);
      registerUser(currentUser);
      emitStrokeAdd(stroke);
    });

    unique.forEach((draft) => {
      const idx = findIndexById(draftStrokes, draft.id);
      if (idx >= 0) draftStrokes.splice(idx, 1);
      if (socketConnected) {
        socket.emit("draft:stroke:remove", { boardId, id: draft.id });
      }
    });

    textTargets.forEach((text) => {
      text.layer = targetLayer;
      if (socketConnected) {
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: text.id,
          patch: { layer: targetLayer, frameId: text.frameId || null, frameTab: text.frameTab || null },
        });
      }
    });

    refreshTextList();
    selected = null;
    multiSelection = null;
    redraw();
  }

  function moveSelectionToBase() {
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
      } else if (item.type === "image") {
        const img = images[item.index];
        if (img && img.layer !== "base") {
          img.layer = "base";
          if (socketConnected) {
            socket.emit("item:update", {
              boardId,
              type: "image",
              id: img.id,
              patch: { layer: "base" },
            });
          }
        }
      }
    });
    refreshImageList();
    redraw();
  }

  function moveSelectionToImage() {
    if (!isAdminUser()) {
      showTransientFooterMessage("背景レイヤーへの移動は Admin のみ可能です。", 4000);
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

  function getFrameCandidateObject(item) {
    if (!item) return null;
    if (item.type === "stroke") return strokes[item.index] || null;
    if (item.type === "draft") return draftStrokes[item.index] || null;
    if (item.type === "text") return texts[item.index] || null;
    if (item.type === "image") return images[item.index] || null;
    return null;
  }

  function findFrameForBackgroundMove(item) {
    const obj = getFrameCandidateObject(item);
    if (!obj) return null;
    if (obj.frameId) {
      const frame = getFrameById(obj.frameId);
      if (frame) return frame;
    }

    const bounds = getBoundsForFrameContentCandidate(item);
    if (!bounds) return null;
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    let owner = null;
    getFrameImagesForGrouping().forEach(({ img }) => {
      if (item.type === "image" && obj.id === img.id) return;
      const frameBounds = getImageBoundsWorld(img);
      if (!frameBounds) return;
      if (!rectContainsRect(frameBounds, bounds) && !pointInRectWorld(frameBounds, center)) return;
      const order = getFrameOrder(img);
      if (!owner || order > owner.order) owner = { frame: img, order };
    });
    return owner?.frame || null;
  }

  function getFrameBackgroundMovePatch(item) {
    const frame = findFrameForBackgroundMove(item);
    if (!frame?.id) return null;
    return { frameId: frame.id, frameTab: "background" };
  }

  function moveSelectionToFrameBackground() {
    const items = getSelectionItems();
    if (!items.length) return;
    let changed = false;
    const applyPatch = (type, obj, patch) => {
      if (!obj || !patch) return;
      if ((obj.frameId || null) === patch.frameId && (obj.frameTab || null) === patch.frameTab) return;
      if (!changed) ensureSnapshotForAction();
      obj.frameId = patch.frameId;
      obj.frameTab = patch.frameTab;
      changed = true;
      if (type === "draft") {
        if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: obj });
      } else {
        emitItemPatch(type, obj, patch);
      }
    };

    items.forEach((item) => {
      if (item.type === "stroke") {
        applyPatch("stroke", strokes[item.index], getFrameBackgroundMovePatch(item));
      } else if (item.type === "stroke-group") {
        item.indices.forEach((idx) => {
          const target = { type: "stroke", index: idx };
          applyPatch("stroke", strokes[idx], getFrameBackgroundMovePatch(target));
        });
      } else if (item.type === "text") {
        applyPatch("text", texts[item.index], getFrameBackgroundMovePatch(item));
      } else if (item.type === "image") {
        const img = images[item.index];
        if (!isFrameContainer(img)) applyPatch("image", img, getFrameBackgroundMovePatch(item));
      } else if (item.type === "draft") {
        applyPatch("draft", draftStrokes[item.index], getFrameBackgroundMovePatch(item));
      } else if (item.type === "draft-group") {
        item.indices.forEach((idx) => {
          const target = { type: "draft", index: idx };
          applyPatch("draft", draftStrokes[idx], getFrameBackgroundMovePatch(target));
        });
      }
    });

    if (changed) {
      redraw();
    } else {
      showTransientFooterMessage("背景タブへ移動できるフレーム内の項目がありません。", 3500);
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
  const socket = io({
    transports: ["websocket", "polling"],
  });
  let socketConnected = false;
  let socketReady = false;

  socket.on("connect", () => {
    socketConnected = true;
    socketReady = false;
    socket.emit("join", { boardId });
    identifyToServer();
  });

  socket.on("disconnect", () => {
    socketConnected = false;
    socketReady = false;
    showTransientFooterMessage("サーバとの接続が切れました。再接続を待っています。", 6000);
  });

  socket.on("error-message", (message) => {
    if (message) showTransientFooterMessage(message, 6000);
  });

  function identifyToServer() {
    if (!socketConnected || !currentUser || isDetachedBoardView) return;
    socket.emit("user:identify", {
      boardId,
      user: currentUser,
      favoriteColor: getCurrentRegisteredFavoriteColor(),
      presence: !draftBoardViewId && !linkBoardView,
    });
  }

  function applyFollowView(view) {
    if (!followTargetUser || !view) return;
    if (![view.x, view.y, view.scale, view.width, view.height].every(Number.isFinite)) return;
    if (view.width <= 0 || view.height <= 0 || view.scale <= 0) return;
    latestFollowView = view;

    const targetAspect = view.width / view.height;
    fitDetachedCanvas(targetAspect);

    const worldWidth = view.width / view.scale;
    const worldHeight = view.height / view.scale;
    scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);
    offsetX = canvas.width / 2 - view.x * scale;
    offsetY = canvas.height / 2 - view.y * scale;
    redraw();
  }

  function fitDetachedCanvas(targetAspect) {
    const windowAspect = window.innerWidth / Math.max(1, window.innerHeight);
    let displayWidth;
    let displayHeight;
    if (windowAspect > targetAspect) {
      displayHeight = window.innerHeight;
      displayWidth = displayHeight * targetAspect;
    } else {
      displayWidth = window.innerWidth;
      displayHeight = displayWidth / targetAspect;
    }
    container.style.width = `${displayWidth}px`;
    container.style.height = `${displayHeight}px`;
    container.style.left = `${(window.innerWidth - displayWidth) / 2}px`;
    container.style.top = `${(window.innerHeight - displayHeight) / 2}px`;
    container.style.right = "auto";
    container.style.bottom = "auto";

    const rect = container.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
  }

  function applyLinkBoardView() {
    if (!linkBoardView) return;
    fitDetachedCanvas(linkBoardView.width / linkBoardView.height);
    scale = Math.min(
      canvas.width / linkBoardView.width,
      canvas.height / linkBoardView.height
    );
    offsetX = canvas.width / 2 - (linkBoardView.x + linkBoardView.width / 2) * scale;
    offsetY = canvas.height / 2 - (linkBoardView.y + linkBoardView.height / 2) * scale;
    redraw();
  }

  function applyDraftBoardView() {
    if (!draftBoardViewId) return false;
    const board = images.find((img) => img?.id === draftBoardViewId && img.draftBoardSource);
    if (!board) return false;
    const rect = { x: board.x, y: board.y, width: board.width, height: board.height };
    fitDetachedCanvas(rect.width / rect.height);
    scale = Math.min(canvas.width / rect.width, canvas.height / rect.height);
    offsetX = canvas.width / 2 - (rect.x + rect.width / 2) * scale;
    offsetY = canvas.height / 2 - (rect.y + rect.height / 2) * scale;
    redraw();
    return true;
  }

  function emitCurrentViewPresence() {
    if (isDetachedBoardView || draftBoardViewId || linkBoardView || !socketConnected || !socketReady || !currentUser) return;
    const now = Date.now();
    const view = {
      x: (canvas.width / 2 - offsetX) / scale,
      y: (canvas.height / 2 - offsetY) / scale,
      scale,
      width: canvas.width,
      height: canvas.height,
    };
    const changed =
      !lastEmittedView ||
      Math.abs(view.x - lastEmittedView.x) > 0.01 ||
      Math.abs(view.y - lastEmittedView.y) > 0.01 ||
      Math.abs(view.scale - lastEmittedView.scale) > 0.0001 ||
      view.width !== lastEmittedView.width ||
      view.height !== lastEmittedView.height;
    if (!changed && now - lastViewPresenceEmitAt < 1000) return;
    if (now - lastViewPresenceEmitAt < 50) {
      if (!viewPresenceTimer) {
        viewPresenceTimer = setTimeout(() => {
          viewPresenceTimer = null;
          emitCurrentViewPresence();
        }, 50 - (now - lastViewPresenceEmitAt));
      }
      return;
    }
    lastViewPresenceEmitAt = now;
    lastEmittedView = view;
    socket.emit("presence:view", { boardId, view });
  }

  function updateScreenShareLayout() {
    document.body.classList.toggle("screen-share-focus", screenShareFocus && !!activeScreenShareSocketId);
    applyScreenShareWindowPosition();
    resizeCanvas();
  }

  function clampScreenSharePosition(pos) {
    if (!screenShareView || !pos) return null;
    const margin = 8;
    const rect = screenShareView.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 158;
    return {
      x: Math.min(Math.max(margin, pos.x), Math.max(margin, window.innerWidth - width - margin)),
      y: Math.min(Math.max(margin, pos.y), Math.max(margin, window.innerHeight - height - margin)),
    };
  }

  function applyScreenShareWindowPosition() {
    if (!screenShareView || screenShareView.classList.contains("hidden")) return;
    if (screenShareFocus) {
      screenShareView.style.left = "";
      screenShareView.style.top = "";
      screenShareView.style.right = "";
      screenShareView.style.bottom = "";
      return;
    }
    if (!screenShareWindowPosition) {
      screenShareView.style.left = "";
      screenShareView.style.top = "";
      screenShareView.style.right = "";
      screenShareView.style.bottom = "";
      return;
    }
    const pos = clampScreenSharePosition(screenShareWindowPosition);
    if (!pos) return;
    screenShareWindowPosition = pos;
    screenShareView.style.left = `${pos.x}px`;
    screenShareView.style.top = `${pos.y}px`;
    screenShareView.style.right = "auto";
    screenShareView.style.bottom = "auto";
  }

  function showScreenShareStream(socketId, user, stream) {
    if (!screenShareView || !screenShareVideo || !stream) return;
    activeScreenShareSocketId = socketId;
    activeScreenShareUser = user || "画面共有";
    screenShareVideo.srcObject = stream;
    if (screenShareLabel) {
      screenShareLabel.textContent = `${activeScreenShareUser} の画面共有`;
    }
    screenShareView.classList.remove("hidden");
    screenShareVideo.play().catch(() => {});
    updateLocalScreenShareButton();
    updateScreenShareLayout();
  }

  function updateLocalScreenShareButton() {
    if (!screenShareToggleBtn) return;
    const isLocalPreview = !!localScreenStream && activeScreenShareSocketId === socket.id;
    screenShareToggleBtn.classList.toggle("hidden", !isLocalPreview);
    screenShareToggleBtn.classList.toggle("is-on", localScreenShareActive);
    screenShareToggleBtn.textContent = localScreenShareActive ? "OFF" : "ON";
  }

  function showLocalScreenSharePreview() {
    if (!localScreenStream) return;
    showScreenShareStream(socket.id, currentUser || "自分", localScreenStream);
    if (screenShareLabel) {
      screenShareLabel.textContent = localScreenShareActive
        ? `${currentUser || "自分"} の画面共有`
        : "画面共有準備中";
    }
    updateLocalScreenShareButton();
  }

  function hideScreenShareStream(socketId) {
    if (socketId && activeScreenShareSocketId !== socketId) return;
    activeScreenShareSocketId = null;
    activeScreenShareUser = "";
    screenShareFocus = false;
    if (screenShareVideo) screenShareVideo.srcObject = null;
    if (screenShareView) screenShareView.classList.add("hidden");
    updateLocalScreenShareButton();
    updateScreenShareLayout();
  }

  function closeScreenSharePeer(peerId) {
    const peer = screenSharePeers.get(peerId);
    if (peer) peer.close();
    screenSharePeers.delete(peerId);
  }

  function createScreenSharePeer(peerId) {
    closeScreenSharePeer(peerId);
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    screenSharePeers.set(peerId, peer);
    if (localScreenShareActive && localScreenStream) {
      localScreenStream.getTracks().forEach((track) => peer.addTrack(track, localScreenStream));
    }
    peer.onicecandidate = (event) => {
      if (!event.candidate || !socketConnected) return;
      socket.emit("screen-share:signal", {
        boardId,
        to: peerId,
        data: { type: "candidate", candidate: event.candidate },
      });
    };
    peer.ontrack = (event) => {
      const stream = event.streams && event.streams[0];
      if (!stream) return;
      const info = knownScreenSharers.get(peerId) || {};
      remoteScreenStreams.set(peerId, stream);
      showScreenShareStream(peerId, info.user || "画面共有", stream);
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        closeScreenSharePeer(peerId);
      }
    };
    return peer;
  }

  async function requestScreenShareFrom(socketId) {
    if (!socketConnected || !socketId || socketId === socket.id || screenSharePeers.has(socketId)) return;
    const peer = createScreenSharePeer(socketId);
    try {
      if (peer.addTransceiver) {
        peer.addTransceiver("video", { direction: "recvonly" });
      }
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("screen-share:signal", {
        boardId,
        to: socketId,
        data: { type: "offer", sdp: peer.localDescription },
      });
    } catch (err) {
      console.warn("Failed to request screen share", err);
      closeScreenSharePeer(socketId);
    }
  }

  async function prepareScreenShare() {
    if (localScreenStream) {
      showLocalScreenSharePreview();
      return;
    }
    if (!requireUser()) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showTransientFooterMessage("このブラウザでは画面共有を使えません。", 5000);
      return;
    }
    try {
      localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const [track] = localScreenStream.getVideoTracks();
      if (track) {
        track.applyConstraints({
          frameRate: { max: 12 },
          width: { max: 1280 },
          height: { max: 720 },
        }).catch(() => {});
        track.addEventListener("ended", () => stopScreenShare());
      }
      localScreenShareActive = false;
      showLocalScreenSharePreview();
      showTransientFooterMessage("共有対象を選びました。右下のONボタンで画面共有を開始します。", 5000);
    } catch (err) {
      localScreenStream = null;
      if (err?.name !== "NotAllowedError") {
        showTransientFooterMessage("画面共有を開始できませんでした。", 5000);
      }
    }
  }

  function startScreenShareBroadcast() {
    if (!localScreenStream) {
      prepareScreenShare();
      return;
    }
    if (localScreenShareActive) return;
    localScreenShareActive = true;
    Array.from(screenSharePeers.keys()).forEach(closeScreenSharePeer);
    showLocalScreenSharePreview();
    if (socketConnected) {
      socket.emit("screen-share:status", { boardId, active: true, user: currentUser });
    }
    showTransientFooterMessage("画面共有を開始しました。右下のOFFボタンで停止できます。", 5000);
  }

  function stopScreenShareBroadcast() {
    if (!localScreenShareActive) return;
    localScreenShareActive = false;
    Array.from(screenSharePeers.keys()).forEach(closeScreenSharePeer);
    if (socketConnected) {
      socket.emit("screen-share:status", { boardId, active: false });
    }
    showLocalScreenSharePreview();
    showTransientFooterMessage("画面共有を停止しました。右下のONボタンで再開できます。", 4000);
  }

  function stopScreenShare() {
    if (!localScreenStream) return;
    const stream = localScreenStream;
    localScreenStream = null;
    const wasActive = localScreenShareActive;
    localScreenShareActive = false;
    stream.getTracks().forEach((track) => track.stop());
    Array.from(screenSharePeers.keys()).forEach(closeScreenSharePeer);
    if (wasActive && socketConnected) {
      socket.emit("screen-share:status", { boardId, active: false });
    }
    hideScreenShareStream(socket.id);
    showTransientFooterMessage("画面共有を終了しました。", 4000);
  }

  function toggleScreenShareBroadcast() {
    if (localScreenShareActive) {
      stopScreenShareBroadcast();
    } else {
      startScreenShareBroadcast();
    }
  }

  function handleHiddenCommandKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return false;
    hiddenCommandBuffer = (hiddenCommandBuffer + e.key.toLowerCase()).slice(-24);
    if (hiddenCommandBuffer.endsWith("screenshare")) {
      hiddenCommandBuffer = "";
      e.preventDefault();
      prepareScreenShare();
      return true;
    }
    return false;
  }

  // --- テキストのバウンディングボックス ---
  function getTextBoundsWorld(t) {
    const fontSize = t.fontSize || 16;
    const lineHeight = fontSize * 1.2;
    const paddingX = Math.max(4, fontSize * 0.35); // 横は少し広め
    const paddingY = Math.max(2, fontSize * 0.15); // 縦の余白は控えめに
    const lines = t.lines && t.lines.length ? t.lines : [""];
    if (t.gridText) {
      const maxChars = lines.reduce((max, line) => Math.max(max, Array.from(line || "").length || 1), 1);
      return {
        x: t.x - paddingX,
        y: t.y - paddingY,
        width: (t.vertical ? lines.length : maxChars) * fontSize + paddingX * 2,
        height: (t.vertical ? maxChars : lines.length) * fontSize + paddingY * 2,
      };
    }
    if (t.vertical) {
      const maxChars = lines.reduce((max, line) => Math.max(max, Array.from(line || "").length || 1), 1);
      return {
        x: t.x - paddingX,
        y: t.y - paddingY,
        width: lines.length * lineHeight + paddingX * 2,
        height: maxChars * lineHeight + paddingY * 2,
      };
    }

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    const maxWidth = lines.reduce((max, line) => {
      const w = ctx.measureText(line || "").width;
      return Math.max(max, w);
    }, 0);
    ctx.restore();

    const h = lineHeight * lines.length;
    return {
      x: t.x - paddingX,
      y: t.y - paddingY,
      width: maxWidth + paddingX * 2,
      height: h + paddingY * 2,
    };
  }

  function getLinkBoundsWorld(link) {
    return {
      x: link.x,
      y: link.y,
      width: link.width || 320,
      height: link.height || 150,
    };
  }

  function getLinkImageSrc(src) {
    if (!src) return "";
    try {
      const parsed = new URL(src, window.location.href);
      if (parsed.origin === window.location.origin) return parsed.toString();
      return `/api/link-image?url=${encodeURIComponent(parsed.toString())}`;
    } catch {
      return src;
    }
  }

  function getYouTubeVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
      if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
        if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
      }
    } catch {
      return "";
    }
    return "";
  }

  function getLinkThumbnail(link) {
    if (link.image) return link.image;
    const youtubeId = getYouTubeVideoId(link.url);
    if (youtubeId) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    if (link.favicon) return link.favicon;
    try {
      return new URL("/favicon.ico", link.url).toString();
    } catch {
      return "";
    }
  }

  function getLinkOpenButtonBoundsScreen(link) {
    const p = worldToScreen(link.x, link.y);
    const w = (link.width || 320) * scale;
    const size = Math.max(22, Math.min(36, 30 * scale));
    const margin = Math.max(6, Math.min(12, 8 * scale));
    return {
      x: p.x + w - margin - size,
      y: p.y + margin,
      width: size,
      height: size,
    };
  }

  function drawExternalLinkIconButton(link) {
    const b = getLinkOpenButtonBoundsScreen(link);
    ctx.save();
    roundedRectPath(ctx, b.x, b.y, b.width, b.height, Math.max(4, b.width * 0.18));
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#c7d4df";
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();

    const pad = b.width * 0.24;
    const x0 = b.x + pad;
    const y0 = b.y + pad;
    const x1 = b.x + b.width - pad;
    const y1 = b.y + b.height - pad;
    ctx.strokeStyle = "#12263a";
    ctx.lineWidth = Math.max(2, b.width * 0.09);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + b.height * 0.28);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x1 - b.width * 0.28, y1);
    ctx.moveTo(b.x + b.width * 0.46, b.y + b.height * 0.54);
    ctx.lineTo(x1, y0);
    ctx.moveTo(b.x + b.width * 0.62, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, b.y + b.height * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  function drawLinkCard(link) {
    const p = worldToScreen(link.x, link.y);
    const w = (link.width || 320) * scale;
    const h = (link.height || 150) * scale;
    const pad = 12 * scale;
    const titleH = 32 * scale;
    const bodyY = p.y + pad + titleH;
    const bodyH = Math.max(0, h - titleH - pad * 2);
    const thumbnail = getLinkThumbnail(link);
    const thumbW = Math.min(112 * scale, w * 0.34);

    ctx.save();
    roundedRectPath(ctx, p.x, p.y, w, h, 8 * scale);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#b8c7d6";
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();

    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = "#12263a";
    ctx.font = `${Math.max(12, 15 * scale)}px sans-serif`;
    const buttonBounds = getLinkOpenButtonBoundsScreen(link);
    const titleW = Math.max(20, buttonBounds.x - (p.x + pad) - 8 * scale);
    drawFittedText(ctx, link.title || link.url, p.x + pad, p.y + pad, titleW);
    drawExternalLinkIconButton(link);

    if (thumbnail) {
      const img = link._img || new Image();
      if (!link._img) {
        link._img = img;
        img.onload = redraw;
        img.src = getLinkImageSrc(thumbnail);
      }
      ctx.fillStyle = "#eef3f7";
      ctx.fillRect(p.x, bodyY, thumbW, bodyH);
      if (img.complete && img.naturalWidth > 0) {
        const ratio = Math.max(thumbW / img.naturalWidth, bodyH / img.naturalHeight);
        const dw = img.naturalWidth * ratio;
        const dh = img.naturalHeight * ratio;
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, bodyY, thumbW, bodyH);
        ctx.clip();
        ctx.drawImage(img, p.x + (thumbW - dw) / 2, bodyY + (bodyH - dh) / 2, dw, dh);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#eef3f7";
      ctx.fillRect(p.x, bodyY, thumbW, bodyH);
      ctx.fillStyle = "#52677a";
      ctx.font = `${Math.max(12, 18 * scale)}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const label = (link.siteName || link.url || "?").replace(/^www\./, "").slice(0, 2).toUpperCase();
      ctx.fillText(label, p.x + thumbW / 2, bodyY + bodyH / 2);
    }

    const textX = p.x + thumbW + pad;
    const textW = Math.max(20, w - thumbW - pad * 2);
    ctx.fillStyle = "#52677a";
    ctx.font = `${Math.max(10, 12 * scale)}px sans-serif`;
    drawFittedText(ctx, link.siteName || link.url, textX, bodyY, textW);
    if (link.description) {
      ctx.fillStyle = "#2f3d49";
      drawFittedText(ctx, link.description, textX, bodyY + 26 * scale, textW);
    }
    ctx.restore();
  }

  function canDeleteText(t) {
    if (isOwnDraftBoardItem(t)) return true;
    if ((t.layer || "user") === "base") return activeLayer === "base";
    if (isAdminUser() || activeLayer === "admin") return true;
    return (t.layer || "user") === "user";
  }

  function canDeleteStroke(stroke) {
    if ((stroke.layer || "user") === "base") return activeLayer === "base";
    if (isAdminUser() || activeLayer === "admin") return true;
    return (stroke.layer || "user") === "user";
  }

  function canDeleteDraft(stroke) {
    return stroke && stroke.user === currentUser;
  }

  function findIndexById(arr, id) {
    return arr.findIndex((x) => x.id === id);
  }

  function removeAllById(arr, id) {
    let removed = false;
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      if (arr[i]?.id === id) {
        arr.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  function invalidatePendingImageLoad(id) {
    if (id) pendingImageLoadTokens.delete(id);
  }

  function applyInitialState(state) {
    pendingImageLoadTokens.clear();
    images.forEach((imgObj) => {
      if (imgObj?.id && imgObj?.src && imgObj?.img) {
        imageElementCache.set(imgObj.id, { src: imgObj.src, img: imgObj.img });
      }
    });
    if (state?.title) {
      boardTitle = state.title;
    }
    updateBoardTitleDisplay();

    strokes.length = 0;
    texts.length = 0;
    images.length = 0;
    links.length = 0;
    orderCounter = 0;
    textListOrderCounter = 0;
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
      state.images.forEach((img) => addImageFromNetwork(img, false, { deferLoad: true }));
    }
    if (state?.links) {
      state.links.forEach((link) => addLinkFromNetwork(link, false));
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
    const hasTextListOrder = typeof text.textListOrder === "number";
    const textListOrder = hasTextListOrder ? text.textListOrder : bumpTextListOrderCounter();
    const withCreated = {
      ...text,
      createdAt: text.createdAt || Date.now(),
      label: text.label || "",
      layer: text.layer || "user",
      rotation: text.rotation || 0,
      vertical: !!text.vertical,
      gridText: !!text.gridText,
      textListOrder,
    };
    texts.push(withCreated);
    if (hasTextListOrder) bumpTextListOrderCounter(textListOrder);
    bumpOrderCounter(text.order);
    registerUser(text.user);
    refreshTextList();
    if (shouldRedraw) redraw();
  }

  function addImageFromNetwork(imgData, shouldRedraw = true, options = {}) {
    if (findIndexById(images, imgData.id) >= 0) return;
    const cached = imageElementCache.get(imgData.id);
    const img = cached?.src === imgData.src && cached.img ? cached.img : null;
    const imageListOrder =
      typeof imgData.imageListOrder === "number" ? imgData.imageListOrder : bumpImageListOrderCounter();
    const imageObj = {
      ...imgData,
      rotation: imgData.rotation || 0,
      mirrored: !!imgData.mirrored,
      imageName: imgData.imageName || "",
      imageListOrder,
      frameId: imgData.frameId || null,
      frameTab: imgData.frameTab || null,
      frameTabs: imgData.frameTabs || null,
      activeFrameTab: imgData.activeFrameTab || null,
      linkBoardSource: imgData.linkBoardSource || null,
      draftBoardSource: imgData.draftBoardSource || null,
      draftBoardId: imgData.draftBoardId || null,
      lassoToolObject: !!imgData.lassoToolObject,
      lassoOutlinePath: Array.isArray(imgData.lassoOutlinePath)
        ? imgData.lassoOutlinePath.map((p) => ({ x: p.x, y: p.y }))
        : null,
      img,
    };
    images.push(imageObj);
    if (isFrameContainer(imageObj)) ensureFrameTabs(imageObj);
    bumpImageListOrderCounter(imageListOrder);
    bumpOrderCounter(imgData.order);
    registerUser(imgData.user);
    refreshImageList();
    if (!isBoardOverlayImage(imageObj) && (!options.deferLoad || isImageNearViewport(imageObj))) {
      ensureImageElementForImage(imageObj, { redrawOnLoad: shouldRedraw || options.redrawOnLoad });
    }
    if (shouldRedraw) redraw();
  }

  function addLinkFromNetwork(linkData, shouldRedraw = true) {
    if (findIndexById(links, linkData.id) >= 0) return;
    links.push({
      ...linkData,
      title: linkData.title || linkData.url || "",
      description: linkData.description || "",
      image: linkData.image || "",
      favicon: linkData.favicon || "",
      siteName: linkData.siteName || "",
      width: linkData.width || 320,
      height: linkData.height || 150,
      layer: linkData.layer || "user",
      createdAt: linkData.createdAt || Date.now(),
    });
    bumpOrderCounter(linkData.order);
    registerUser(linkData.user);
    refreshLinkList();
    refreshLinkPreviewIfNeeded(links[links.length - 1]);
    if (shouldRedraw) redraw();
  }

  socket.on("init", (state) => {
    applyInitialState(state);
    socketReady = true;
    restorePendingAdds();
    flushPendingAdds();
    refreshUserDatalist();
    updateFavButtons();
    refreshTextList();
    if (draftBoardViewId) applyDraftBoardView();
    else {
      restoreFloatingDraftBoards();
    }
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

  socket.on("link:add", (link) => {
    addLinkFromNetwork(link);
  });

  socket.on("draft:init", (drafts) => {
    draftStrokes.length = 0;
    draftOrderCounter = 0;
    (drafts || []).forEach((d) => addDraftFromNetwork(d, false));
    draftsLoaded = true;
    migrateLegacyDraftBoardOriginalIds();
    restoreFloatingDraftBoards();
    redraw();
    updateFooterByState();
  });

  socket.on("board:title:update", ({ title }) => {
    boardTitle = title || boardId;
    updateBoardTitleDisplay();
  });

  socket.on("presence:users", (users) => {
    onlineUsers = Array.isArray(users) ? users.filter((name) => typeof name === "string" && name) : [];
    renderWatchUsersMenu();
    if (followViewLabel && followTargetUser) {
      followViewLabel.textContent = onlineUsers.includes(followTargetUser)
        ? `${followTargetUser}の位置にジャンブ`
        : `👀 ${followTargetUser} は現在オフラインです`;
      followViewLabel.classList.toggle("is-jump-action", onlineUsers.includes(followTargetUser));
    }
  });

  socket.on("presence:views", (views) => {
    if (!followTargetUser || !Array.isArray(views)) return;
    const view = views.slice().reverse().find((entry) => entry?.user === followTargetUser);
    if (view) applyFollowView(view);
  });

  socket.on("presence:view", (view) => {
    if (!followTargetUser || view?.user !== followTargetUser) return;
    applyFollowView(view);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.type === "whiteboard:draft-toolbar" && (draftBoardViewId || linkBoardView) && data.state) {
      const state = data.state;
      if (typeof state.user === "string" && state.user && state.user !== currentUser) {
        setCurrentUser(state.user);
      }
      if (typeof state.color === "string") {
        currentColor = state.color;
        textDefaultColor = state.color;
      }
      if (Number.isFinite(state.size)) {
        currentSize = state.size;
        sizeRange.value = String(state.size);
        sizeLabel.textContent = String(state.size);
      }
      strokesDimmed = !!state.strokesDimmed;
      pendingTextMode = null;
      if (typeof state.tool === "string" && state.tool.startsWith("text:")) {
        pendingTextMode = state.tool.slice(5) === "grid" ? "grid" : "normal";
        currentTool = "select";
      } else if (["pen", "fill", "eraser", "select"].includes(state.tool)) {
        currentTool = state.tool;
      }
      updateToolButtons();
      redraw();
      return;
    }
    if (data?.type === "whiteboard:draft-command" && draftBoardViewId) {
      migrateLegacyDraftBoardOriginalIds();
      const board = images.find((img) => img?.id === draftBoardViewId);
      const toolbarState = data.toolbarState || {};
      const publishOptions = {
        owner: toolbarState.user || currentUser,
        glowColor: toolbarState.glowColor || getUserRegisteredFavoriteColor(toolbarState.user || currentUser),
        originalObjectIds: data.originalObjectIds,
      };
      if (data.command === "publish") publishDraftBoard(board, data.targetRect, publishOptions);
      if (data.command === "publish-source") publishDraftBoard(board, null, { ...publishOptions, onlyNew: true });
      if (data.command === "delete") deleteDraftBoard(board);
      // 親画面は item:remove の受信後に閉じる。通信断時だけ完了通知をフォールバックにする。
      setTimeout(() => {
        window.parent.postMessage(
          { type: "whiteboard:draft-command-complete", boardId: draftBoardViewId },
          window.location.origin
        );
      }, 1000);
      return;
    }
    if (data?.type === "whiteboard:draft-command-complete" && !draftBoardViewId) {
      const frame = Array.from(document.querySelectorAll(".floating-draft-board"))
        .find((item) => item.dataset.boardId === data.boardId);
      frame?._closeFloating?.();
      setActiveLayer("user");
      return;
    }
    if (isDetachedBoardView) return;
    if (data?.type !== "whiteboard:jump-to-follow-view" || !data.view) return;
    const view = data.view;
    if (![view.x, view.y, view.scale].every(Number.isFinite)) return;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
    offsetX = canvas.width / 2 - view.x * scale;
    offsetY = canvas.height / 2 - view.y * scale;
    redraw();
    showTransientFooterMessage(`${data.user || "ユーザー"}の表示位置へジャンプしました。`, 2500);
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

  socket.on("presence:writing:start", (data) => {
    if (!data || !data.user) return;
    if (data.socketId && data.socketId === socket.id) return;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    const key = data.socketId || data.user;
    writingLabels.set(key, {
      user: data.user,
      x: data.x,
      y: data.y,
      updatedAt: Date.now(),
      ending: false,
    });
    ensureWritingLabelCleanup();
    redraw();
  });

  socket.on("presence:writing:update", (data) => {
    if (!data || !data.user) return;
    if (data.socketId && data.socketId === socket.id) return;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    const key = data.socketId || data.user;
    const label = writingLabels.get(key);
    if (!label) {
      writingLabels.set(key, {
        user: data.user,
        x: data.x,
        y: data.y,
        updatedAt: Date.now(),
        ending: false,
      });
      ensureWritingLabelCleanup();
    } else {
      label.user = data.user;
      label.x = data.x;
      label.y = data.y;
      label.updatedAt = Date.now();
      label.ending = false;
    }
    redraw();
  });

  socket.on("presence:writing:end", (data = {}) => {
    const key = data.socketId || data.user;
    if (!key) return;
    const label = writingLabels.get(key);
    if (!label) return;
    label.ending = true;
    label.updatedAt = Date.now();
    setTimeout(() => {
      if (writingLabels.get(key) !== label) return;
      writingLabels.delete(key);
      if (writingLabels.size === 0) stopWritingLabelCleanup();
      redraw();
    }, WRITING_LABEL_END_GRACE_MS);
    redraw();
  });

  socket.on("item:remove", ({ type, id }) => {
    if (type === "stroke") {
      removeAllById(strokes, id);
    } else if (type === "text") {
      removeAllById(texts, id);
    } else if (type === "image") {
      removeAllById(images, id);
      invalidatePendingImageLoad(id);
      refreshImageList();
      const draftFrame = Array.from(document.querySelectorAll(".floating-draft-board"))
        .find((item) => item.dataset.boardId === id);
      draftFrame?._closeFloating?.();
    } else if (type === "link") {
      removeAllById(links, id);
      refreshLinkList();
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
        : type === "image"
        ? images
        : links;
    const idx = findIndexById(list, id);
    if (idx >= 0) {
      if (type === "image") {
        const currentImgEl = list[idx].img;
        list[idx] = { ...list[idx], ...patch, img: currentImgEl };
        if (patch.src && patch.src !== currentImgEl?.src) {
          invalidatePendingImageLoad(id);
          list[idx].img = null;
          list[idx].renderImg = null;
          ensureImageElementForImage(list[idx], { redrawOnLoad: true });
        }
      } else {
        list[idx] = { ...list[idx], ...patch };
      }
      if (type === "text") {
        refreshTextList();
      } else if (type === "image") {
        refreshImageList();
      } else if (type === "link") {
        refreshLinkList();
      }
      redraw();
      updateFooterByState();
    }
  });

  socket.on("screen-share:active", (shares) => {
    (shares || []).forEach((share) => {
      if (!share?.socketId || share.socketId === socket.id) return;
      knownScreenSharers.set(share.socketId, { user: share.user || "" });
      requestScreenShareFrom(share.socketId);
    });
  });

  socket.on("screen-share:status", ({ socketId, user, active }) => {
    if (!socketId || socketId === socket.id) return;
    if (active) {
      knownScreenSharers.set(socketId, { user: user || "" });
      requestScreenShareFrom(socketId);
    } else {
      knownScreenSharers.delete(socketId);
      remoteScreenStreams.delete(socketId);
      closeScreenSharePeer(socketId);
      hideScreenShareStream(socketId);
    }
  });

  socket.on("screen-share:signal", async ({ from, user, data }) => {
    if (!from || !data) return;
    if (user) knownScreenSharers.set(from, { user });
    let peer = screenSharePeers.get(from);
    try {
      if (data.type === "offer") {
        if (!localScreenShareActive || !localScreenStream) return;
        peer = createScreenSharePeer(from);
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("screen-share:signal", {
          boardId,
          to: from,
          data: { type: "answer", sdp: peer.localDescription },
        });
      } else if (data.type === "answer") {
        if (!peer) return;
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === "candidate") {
        if (!peer || !data.candidate) return;
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.warn("Failed to handle screen share signal", err);
      closeScreenSharePeer(from);
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

  function rectContainsRect(container, inner) {
    return (
      inner.x >= container.x &&
      inner.y >= container.y &&
      inner.x + inner.width <= container.x + container.width &&
      inner.y + inner.height <= container.y + container.height
    );
  }

  function getRectIntersection(a, b) {
    if (!a || !b) return null;
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
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

  function getSegmentIntersection(a, b, c, d) {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-9) return null;
    const qpx = c.x - a.x;
    const qpy = c.y - a.y;
    const t = (qpx * sY - qpy * sX) / denom;
    const u = (qpx * rY - qpy * rX) / denom;
    const eps = 1e-6;
    if (t < eps || t > 1 - eps || u < eps || u > 1 - eps) return null;
    return {
      point: { x: a.x + t * rX, y: a.y + t * rY },
      t,
      u,
    };
  }

  function normalizeFillPolygon(points) {
    const normalized = [];
    (points || []).forEach((p) => {
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return;
      const prev = normalized[normalized.length - 1];
      if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 0.01) return;
      normalized.push({ x: p.x, y: p.y });
    });
    if (normalized.length > 2) {
      const first = normalized[0];
      const last = normalized[normalized.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 0.01) normalized.pop();
    }
    return normalized.length >= 3 ? normalized : null;
  }

  function getFillPolygonForStrokeAt(stroke, worldPoint) {
    const pts = stroke?.points || [];
    if (pts.length < 3) return null;

    const candidates = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = i + 2; j < pts.length - 1; j++) {
        if (i === 0 && j === pts.length - 2) continue;
        const hit = getSegmentIntersection(pts[i], pts[i + 1], pts[j], pts[j + 1]);
        if (!hit) continue;
        const loop = normalizeFillPolygon([hit.point, ...pts.slice(i + 1, j + 1), hit.point]);
        if (loop && pointInPolygon(worldPoint, loop)) {
          candidates.push(loop);
        }
      }
    }

    if (isClosedStroke(stroke)) {
      const closed = normalizeFillPolygon(pts);
      if (closed && pointInPolygon(worldPoint, closed)) candidates.push(closed);
    }

    if (!candidates.length && pointInPolygon(worldPoint, pts)) {
      const fallback = normalizeFillPolygon(pts);
      if (fallback) candidates.push(fallback);
    }

    return candidates.sort((a, b) => polygonArea(a) - polygonArea(b))[0] || null;
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

  function isImageCoveredByHigherFrameAtPoint(imgObj, imageIndex, worldPoint) {
    if (!imgObj || isFrameContainer(imgObj) || !worldPoint) return false;
    const owner = findOwningFrameForItem({ type: "image", index: imageIndex });
    const imageOrder = getObjectOrderValue("image", imgObj, imageIndex);
    return getFrameImagesForGrouping().some(({ img: frame, index }) => {
      if (!frame || owner?.frame?.id === frame.id) return false;
      if (!isImageVisible(frame)) return false;
      if (!isFrameMemberVisible(frame, { type: "image", index })) return false;
      if (getFrameOrder(frame) <= imageOrder) return false;
      const frameBounds = getImageBoundsWorld(frame);
      return frameBounds && pointInRotatedRectWorld(worldPoint, frameBounds, frame.rotation || 0);
    });
  }

  function getRenderLayerPriority(layer) {
    if (layer === "image") return 0;
    if (layer === "base") return 1;
    if (layer === "user" || layer === "admin") return 2;
    if (layer === "draft") return 3;
    return 4;
  }

  function getDraftBoardRenderInfo(item) {
    if (!item) return null;
    if (item.type === "image") {
      const img = images[item.index];
      if (!img) return null;
      if (isDraftBoardImage(img)) {
        return {
          groupId: img.id,
          rank: 0,
          order: typeof img.order === "number" ? img.order : 0,
          createdAt: img.createdAt || 0,
        };
      }
      if (img.draftBoardId) {
        return {
          groupId: img.draftBoardId,
          rank: 1,
          order: typeof img.order === "number" ? img.order : 0,
          createdAt: img.createdAt || 0,
        };
      }
    }
    if (item.type === "draft-stroke") {
      const stroke = draftStrokes[item.index];
      if (!stroke?.draftBoardId) return null;
      return {
        groupId: stroke.draftBoardId,
        rank: 2,
        order: typeof stroke.order === "number" ? stroke.order : 0,
        createdAt: stroke.createdAt || 0,
      };
    }
    if (item.type === "text") {
      const text = texts[item.index];
      if (!text?.draftBoardId) return null;
      return {
        groupId: text.draftBoardId,
        rank: 2,
        order: typeof text.order === "number" ? text.order : 0,
        createdAt: text.createdAt || 0,
      };
    }
    return null;
  }

  function getImageHitDrawInfo(imgObj, index, rankOverride = null) {
    const order = getObjectOrderValue("image", imgObj, index);
    let frameGroupId = null;
    let frameGroupOrder = null;
    let frameGroupRank = null;

    if (isFrameContainer(imgObj)) {
      const owner = findOwningFrameForItem({ type: "image", index });
      if (owner) {
        frameGroupId = owner.frame.id;
        frameGroupOrder = owner.order;
        frameGroupRank = getFrameMemberDrawRank(imgObj);
      } else {
        frameGroupId = imgObj.id;
        frameGroupOrder = getFrameOrder(imgObj);
        frameGroupRank = 0;
      }
    } else if (isOmoteUraTagImage(imgObj)) {
      frameGroupId = imgObj.id;
      frameGroupOrder = order;
      frameGroupRank = 0;
    } else {
      const owner = findOwningFrameForItem({ type: "image", index });
      if (owner) {
        frameGroupId = owner.frame.id;
        frameGroupOrder = owner.order;
        frameGroupRank = getFrameMemberDrawRank(imgObj);
      } else {
        const omoteUraOwner = findOwningOmoteUraFrameForImage(imgObj);
        if (omoteUraOwner) {
          frameGroupId = omoteUraOwner.frame.id;
          frameGroupOrder = omoteUraOwner.order;
          frameGroupRank = 3;
        }
      }
    }

    if (typeof rankOverride === "number") {
      frameGroupRank = rankOverride;
    }

    return {
      index,
      order,
      arrayIndex: index,
      layerPriority: getRenderLayerPriority(imgObj?.layer || "base"),
      frameGroupId,
      frameGroupOrder,
      frameGroupRank,
    };
  }

  function compareImageHitDrawOrder(a, b) {
    if (a.frameGroupId || b.frameGroupId) {
      const groupA = typeof a.frameGroupOrder === "number" ? a.frameGroupOrder : a.order ?? 0;
      const groupB = typeof b.frameGroupOrder === "number" ? b.frameGroupOrder : b.order ?? 0;
      if (groupA !== groupB) return groupA - groupB;
      if (a.frameGroupId && b.frameGroupId && a.frameGroupId === b.frameGroupId) {
        const rankA = a.frameGroupRank ?? 1;
        const rankB = b.frameGroupRank ?? 1;
        if (rankA !== rankB) return rankA - rankB;
      }
    }
    if (a.layerPriority !== b.layerPriority) return a.layerPriority - b.layerPriority;
    if (a.order !== b.order) return a.order - b.order;
    return a.arrayIndex - b.arrayIndex;
  }

  function getHitTypeOrder(type) {
    if (type === "stroke") return 0;
    if (type === "draft") return 1;
    if (type === "image") return 2;
    if (type === "text") return 3;
    if (type === "link") return 4;
    return 5;
  }

  function getHitDrawInfoForItem(item) {
    if (!item) return null;
    const type = item.type;
    const index = item.index;
    let obj = null;
    let layer = "user";
    let order = 0;
    let frameGroupId = null;
    let frameGroupOrder = null;
    let frameGroupRank = null;

    if (type === "image") {
      obj = images[index];
      if (!obj) return null;
      const info = getImageHitDrawInfo(obj, index);
      layer = obj.layer || "base";
      order = info.order;
      frameGroupId = info.frameGroupId;
      frameGroupOrder = info.frameGroupOrder;
      frameGroupRank = info.frameGroupRank;
    } else if (type === "text") {
      obj = texts[index];
      if (!obj) return null;
      layer = obj.layer || "user";
      order = getObjectOrderValue("text", obj, index);
      const owner = findOwningFrameForItem({ type: "text", index });
      if (owner) {
        frameGroupId = owner.frame.id;
        frameGroupOrder = owner.order;
        frameGroupRank = getFrameMemberDrawRank(obj);
      }
    } else if (type === "stroke") {
      obj = strokes[index];
      if (!obj) return null;
      layer = obj.layer || "user";
      order = getObjectOrderValue("stroke", obj, index);
      const owner = findOwningFrameForItem({ type: "stroke", index });
      if (owner) {
        frameGroupId = owner.frame.id;
        frameGroupOrder = owner.order;
        frameGroupRank = getFrameMemberDrawRank(obj);
      }
    } else if (type === "draft") {
      obj = draftStrokes[index];
      if (!obj) return null;
      layer = "draft";
      order = getObjectOrderValue("draft", obj, index);
      const owner = findOwningFrameForItem({ type: "draft", index });
      if (owner) {
        frameGroupId = owner.frame.id;
        frameGroupOrder = owner.order;
        frameGroupRank = getFrameMemberDrawRank(obj);
      }
    } else if (type === "link") {
      obj = links[index];
      if (!obj) return null;
      layer = obj.layer || "user";
      order = getObjectOrderValue("link", obj, index);
    } else {
      return null;
    }

    const info = {
      item,
      type,
      index,
      order,
      arrayIndex: index,
      typeOrder: getHitTypeOrder(type),
      layerPriority: getRenderLayerPriority(layer),
      frameGroupId,
      frameGroupOrder,
      frameGroupRank,
    };
    const draftType = type === "draft" ? "draft-stroke" : type;
    const draftInfo = getDraftBoardRenderInfo({ type: draftType, index });
    if (draftInfo) {
      info.draftBoardGroupId = draftInfo.groupId;
      info.draftBoardGroupRank = draftInfo.rank;
      info.draftBoardGroupOrder = draftInfo.order;
      info.draftBoardGroupCreatedAt = draftInfo.createdAt;
    }
    return info;
  }

  function compareHitDrawOrder(a, b) {
    if (a.draftBoardGroupId && b.draftBoardGroupId && a.draftBoardGroupId === b.draftBoardGroupId) {
      const rankA = a.draftBoardGroupRank ?? 1;
      const rankB = b.draftBoardGroupRank ?? 1;
      if (rankA !== rankB) return rankA - rankB;
      const createdA = typeof a.draftBoardGroupCreatedAt === "number" ? a.draftBoardGroupCreatedAt : 0;
      const createdB = typeof b.draftBoardGroupCreatedAt === "number" ? b.draftBoardGroupCreatedAt : 0;
      if (createdA !== createdB) return createdA - createdB;
      const orderA = typeof a.draftBoardGroupOrder === "number" ? a.draftBoardGroupOrder : a.order ?? 0;
      const orderB = typeof b.draftBoardGroupOrder === "number" ? b.draftBoardGroupOrder : b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
    }
    if (a.frameGroupId || b.frameGroupId) {
      const groupA = typeof a.frameGroupOrder === "number" ? a.frameGroupOrder : a.order ?? 0;
      const groupB = typeof b.frameGroupOrder === "number" ? b.frameGroupOrder : b.order ?? 0;
      if (groupA !== groupB) return groupA - groupB;
      if (a.frameGroupId && b.frameGroupId && a.frameGroupId === b.frameGroupId) {
        const rankA = a.frameGroupRank ?? 1;
        const rankB = b.frameGroupRank ?? 1;
        if (rankA !== rankB) return rankA - rankB;
      }
    }
    if (a.layerPriority !== b.layerPriority) return a.layerPriority - b.layerPriority;
    if (a.order !== b.order) return a.order - b.order;
    if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
    return a.arrayIndex - b.arrayIndex;
  }

  function hitTestImage(screenX, screenY, options = {}) {
    const includeFrameHeader = options.includeFrameHeader !== false;
    const includeFrameBody = options.includeFrameBody !== false;
    const includeNonFrameImages = options.includeNonFrameImages !== false;
    const worldPoint = screenToWorld(screenX, screenY);
    let bestHit = null;
    if (includeFrameHeader) {
      for (let i = images.length - 1; i >= 0; i--) {
        const imgObj = images[i];
        if (!isFrameContainer(imgObj) || !canInteractImage(imgObj)) continue;
        if (pointInScreenRect({ x: screenX, y: screenY }, getFrameHeaderHitBoundsScreen(imgObj))) {
          const hit = getImageHitDrawInfo(imgObj, i, 4);
          if (!bestHit || compareImageHitDrawOrder(hit, bestHit) > 0) bestHit = hit;
          continue;
        }
        const bounds = getFrameHeaderBoundsWorld(imgObj);
        if (!bounds) continue;
        if (pointInRotatedRectWorld(worldPoint, bounds, imgObj.rotation || 0)) {
          const hit = getImageHitDrawInfo(imgObj, i, 4);
          if (!bestHit || compareImageHitDrawOrder(hit, bestHit) > 0) bestHit = hit;
        }
      }
    }
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canInteractImage(imgObj)) continue;
      if (isFrameContainer(imgObj) && !includeFrameBody) continue;
      if (!isFrameContainer(imgObj) && !includeNonFrameImages) continue;
      if (
        !isFrameContainer(imgObj) &&
        !includeFrameBody &&
        isImageCoveredByHigherFrameAtPoint(imgObj, i, worldPoint)
      ) {
        continue;
      }
      const bounds = isFrameContainer(imgObj)
        ? getImageBoundsWorld(imgObj)
        : { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height };
      if (!bounds) continue;
      if (pointInRotatedRectWorld(worldPoint, bounds, imgObj.rotation || 0)) {
        const hit = getImageHitDrawInfo(imgObj, i);
        if (!bestHit || compareImageHitDrawOrder(hit, bestHit) > 0) bestHit = hit;
      }
    }
    return bestHit ? bestHit.index : -1;
  }

  function collectTextTagsAtWorldPoint(worldPoint) {
    const tags = [];
    const addTag = (img) => {
      const label = isFrameContainer(img) ? getFrameDisplayName(img) : img.imageName;
      const tag = String(label || "").trim();
      if (!tag) return;
      tags.push({
        label: tag,
        sourceId: img.id,
        sourceType: isFrameContainer(img) ? "frame" : "image",
      });
    };
    const addFrameTabTag = (frameImg) => {
      const tabId = getFrameCurrentTargetTab(frameImg);
      const tag = getFrameTabDisplayName(frameImg, tabId);
      const sourceId = getFrameTabLabelSourceId(frameImg, tabId);
      if (!tag || !sourceId) return;
      tags.push({
        label: tag,
        sourceId,
        sourceType: "frame-tab",
      });
    };
    images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => img && isImageVisible(img))
      .sort((a, b) => getObjectOrderValue("image", a.img, a.index) - getObjectOrderValue("image", b.img, b.index))
      .forEach(({ img }) => {
        if (isOmoteUraTagImage(img)) return;
        const bounds = isFrameContainer(img)
          ? getImageBoundsWorld(img)
          : { x: img.x, y: img.y, width: img.width, height: img.height };
        if (!bounds || !pointInRotatedRectWorld(worldPoint, bounds, img.rotation || 0)) return;
        addTag(img);
        if (isFrameContainer(img)) addFrameTabTag(img);
      });
    return tags;
  }

  function updateTextTagsForRenamedImage(imgObj, oldName, newName) {
    const from = String(oldName || "").trim();
    const to = String(newName || "").trim();
    if (!from || from === to) return;
    const sourceId = imgObj?.id || null;
    const sourceType = imgObj ? (isFrameContainer(imgObj) ? "frame" : "image") : null;
    let changed = false;
    texts.forEach((text) => {
      const tags = parseTextTagEntries(text.label);
      let updated = false;
      const nextTags = tags
        .map((tag) => {
          const sourceMatches = sourceId && tag.sourceId === sourceId;
          const legacyMatches = !tag.sourceId && tag.label === from;
          if (!sourceMatches && !legacyMatches) return tag;
          updated = true;
          return {
            ...tag,
            label: to,
            sourceId: tag.sourceId || sourceId,
            sourceType: tag.sourceType || sourceType,
          };
        })
        .filter((tag) => tag.label);
      if (!updated) return;
      const label = serializeTextTags(nextTags);
      if (label === text.label) return;
      text.label = label;
      changed = true;
      emitItemPatch("text", text, { label });
    });
    if (changed) refreshTextList();
  }

  function updateTextTagsForRenamedFrameTab(frameImg, tabId, oldName, newName) {
    const from = String(oldName || "").trim();
    const to = String(newName || "").trim();
    if (!from || !to || from === to) return;
    const sourceId = getFrameTabLabelSourceId(frameImg, tabId);
    if (!sourceId) return;
    let changed = false;
    texts.forEach((text) => {
      const tags = parseTextTagEntries(text.label);
      let updated = false;
      const nextTags = tags
        .map((tag) => {
          const sourceMatches = tag.sourceId === sourceId;
          const legacyMatches =
            !tag.sourceId && tag.label === from && text.frameId === frameImg.id && text.frameTab === tabId;
          if (!sourceMatches && !legacyMatches) return tag;
          updated = true;
          return {
            ...tag,
            label: to,
            sourceId: tag.sourceId || sourceId,
            sourceType: tag.sourceType || "frame-tab",
          };
        })
        .filter((tag) => tag.label);
      if (!updated) return;
      const label = serializeTextTags(nextTags);
      if (label === text.label) return;
      text.label = label;
      changed = true;
      emitItemPatch("text", text, { label });
    });
    if (changed) refreshTextList();
  }

  function getFrameFollowName(imageName) {
    return String(imageName || "").trim() || "フレーム";
  }

  function getCropSourceTag(sourceId) {
    return sourceId ? `crop-source:${sourceId}` : "";
  }

  function updateFrameNameFromImage(frameImg, imageName) {
    if (!isFrameContainer(frameImg)) return false;
    if (frameImg.tagType === "omoteura") return false;
    const nextName = getFrameFollowName(imageName);
    const oldName = getFrameDisplayName(frameImg);
    if (frameImg.tagLabel === nextName && frameImg.imageName === nextName) return false;
    frameImg.tagLabel = nextName;
    frameImg.imageName = nextName;
    updateTextTagsForRenamedImage(frameImg, oldName, nextName);
    refreshFrameImageForCurrentSize(frameImg, { emit: true });
    return true;
  }

  function syncImageNameToLinkedFrames(imgObj, newName) {
    if (!imgObj || isFrameContainer(imgObj)) return false;
    let changed = false;

    if (imgObj.frameId && imgObj.frameTab === "background") {
      const frameImg = getFrameById(imgObj.frameId);
      changed = updateFrameNameFromImage(frameImg, newName) || changed;
    }

    const sourceTag = getCropSourceTag(imgObj.id);
    images.forEach((cropImg) => {
      if (!cropImg || cropImg === imgObj || isFrameContainer(cropImg)) return;
      if (cropImg.tagLabel !== sourceTag) return;
      const cropOldName = cropImg.imageName || "";
      const cropNewName = getFrameFollowName(newName);
      if (cropOldName !== cropNewName) {
        cropImg.imageName = cropNewName;
        emitItemPatch("image", cropImg, { imageName: cropImg.imageName });
        updateTextTagsForRenamedImage(cropImg, cropOldName, cropImg.imageName);
        changed = true;
      }
      if (cropImg.frameId && cropImg.frameTab === "background") {
        const frameImg = getFrameById(cropImg.frameId);
        changed = updateFrameNameFromImage(frameImg, cropImg.imageName) || changed;
      }
    });

    if (changed) refreshImageList();
    return changed;
  }

  function hitTestImageResizeHandle(screenX, screenY, radius = 12) {
    for (let i = images.length - 1; i >= 0; i--) {
      const imgObj = images[i];
      if (!canInteractImage(imgObj)) continue;
      if (isBoardOverlayImage(imgObj)) continue;
      const hit = hitTestResizeHandlesScreen(
        screenX,
        screenY,
        { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
        imgObj.rotation || 0,
        radius
      );
      if (hit) {
        return { index: i, handle: hit.handle };
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

  function hitTestTextResizeHandle(screenX, screenY, radius = 12) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!isTextVisible(t)) continue;
      if (!canInteractText(t)) continue;
      const b = getTextBoundsWorld(t);
      const hit = hitTestResizeHandlesScreen(screenX, screenY, b, t.rotation || 0, radius);
      if (hit) {
        return { index: i, handle: hit.handle };
      }
    }
    return null;
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
        if (!isImageVisible(img)) return;
        if (!isFrameMemberVisible(img, { type: "image", index: idx })) return;
        const bounds = { x: img.x, y: img.y, width: img.width, height: img.height };
        if (rectContainsRect(rectWorld, bounds)) {
          items.push({ type: "image", index: idx });
        }
      });
      if (isAdminUser()) {
        strokes.forEach((s, idx) => {
          if (!isStrokeVisible(s)) return;
          if (!canInteractStroke(s)) return;
          if (!isFrameMemberVisible(s, { type: "stroke", index: idx })) return;
          const bounds = getStrokeBoundsWorld(s);
          if (bounds && rectContainsRect(rectWorld, bounds)) {
            items.push({ type: "stroke", index: idx });
          }
        });
      }
    } else {
      strokes.forEach((s, idx) => {
        if (!isStrokeVisible(s)) return;
        if (!canInteractStroke(s)) return;
        if (!isFrameMemberVisible(s, { type: "stroke", index: idx })) return;
        const bounds = getStrokeBoundsWorld(s);
        if (bounds && rectContainsRect(rectWorld, bounds)) {
          if (s.groupId) {
            const exists = items.find((it) => it.type === "stroke-group" && it.groupId === s.groupId);
            if (!exists) {
              const indices = [];
              strokes.forEach((st, i) => {
                if (st.groupId !== s.groupId) return;
                if (!isStrokeVisible(st)) return;
                if (!canInteractStroke(st)) return;
                if (!isFrameMemberVisible(st, { type: "stroke", index: i })) return;
                indices.push(i);
              });
              if (indices.length) items.push({ type: "stroke-group", groupId: s.groupId, indices });
            }
          } else {
            items.push({ type: "stroke", index: idx });
          }
        }
      });
      texts.forEach((t, idx) => {
        if (!isTextVisible(t)) return;
        if (!canInteractText(t)) return;
        if (!isFrameMemberVisible(t, { type: "text", index: idx })) return;
        const bounds = getTextBoundsWorld(t);
        if (bounds && rectContainsRect(rectWorld, bounds)) {
          items.push({ type: "text", index: idx });
        }
      });
      links.forEach((link, idx) => {
        if (!isLinkVisible(link)) return;
        if (!canInteractLink(link)) return;
        const bounds = getLinkBoundsWorld(link);
        if (bounds && rectContainsRect(rectWorld, bounds)) {
          items.push({ type: "link", index: idx });
        }
      });
      images.forEach((img, idx) => {
        if (!canInteractImage(img)) return;
        if (!isFrameMemberVisible(img, { type: "image", index: idx })) return;
        const bounds = { x: img.x, y: img.y, width: img.width, height: img.height };
        if (bounds && rectContainsRect(rectWorld, bounds)) {
          items.push({ type: "image", index: idx });
        }
      });
      if (activeLayer === "draft") {
        draftStrokes.forEach((s, idx) => {
          if (!canDeleteDraft(s)) return;
          if (s.user !== currentUser) return;
          if (!isFrameMemberVisible(s, { type: "draft", index: idx })) return;
          const bounds = getStrokeBoundsWorld(s);
          if (bounds && rectContainsRect(rectWorld, bounds)) {
            items.push({ type: "draft", index: idx });
          }
        });
      }
    }

    const selectedFrameIds = new Set(
      items
        .filter((item) => {
          if (item.type !== "image") return false;
          const img = images[item.index];
          if (!isFrameContainer(img)) return false;
          const bounds = getImageBoundsWorld(img);
          return bounds && rectContainsRect(rectWorld, bounds);
        })
        .map((item) => images[item.index]?.id)
        .filter(Boolean)
    );
    const filteredItems = selectedFrameIds.size
      ? items.filter((item) => {
          if (item.type === "image" && isFrameContainer(images[item.index])) return true;
          if (item.type === "stroke-group") {
            return !item.indices.some((idx) => {
              const owner = findOwningFrameForItem({ type: "stroke", index: idx });
              return owner?.frame?.id && selectedFrameIds.has(owner.frame.id);
            });
          }
          if (item.type === "draft-group") {
            return !item.indices.some((idx) => {
              const owner = findOwningFrameForItem({ type: "draft", index: idx });
              return owner?.frame?.id && selectedFrameIds.has(owner.frame.id);
            });
          }
          const owner = findOwningFrameForItem(item);
          return !(owner?.frame?.id && selectedFrameIds.has(owner.frame.id));
        })
      : items;

    if (filteredItems.length === 1) {
      const only = filteredItems[0];
      if (only.type === "image" || only.type === "text") {
        selected = { type: only.type, index: only.index };
      } else if (only.type === "link") {
        selected = { type: "link", index: only.index };
      } else {
        selected = null;
      }
    } else {
      selected = null;
    }

    multiSelection = filteredItems.length
      ? { items: filteredItems, rectScreen: normScreen, rectWorld }
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

  function redraw() {
    if (redrawRafId !== null) return;
    redrawRafId = requestAnimationFrame(() => {
      redrawRafId = null;
      renderNow();
    });
  }

  // --- 描画処理 ---
  function renderNow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameRenderCache = createFrameRenderCache();

    // 1. すべての描画オブジェクトを統合して並び替え
    const combined = [];
    strokes.forEach((s, idx) => {
      if (!isStrokeVisible(s)) return;
      const item = { type: "stroke", index: idx };
      if (!isFramedObjectNearViewport(s, item)) return;
      if (!isFrameMemberVisible(s, item)) return;
      combined.push({
        type: "stroke",
        order: s.order ?? idx,
        index: idx,
        layer: s.layer || "user",
      });
    });
    draftStrokes.forEach((s, idx) => {
      if (!isStrokeVisible(s)) return;
      const item = { type: "draft", index: idx };
      if (!isFramedObjectNearViewport(s, item)) return;
      if (!isFrameMemberVisible(s, item)) return;
      combined.push({
        type: "draft-stroke",
        order: s.order ?? draftStrokes.length + idx,
        index: idx,
        layer: "draft",
      });
    });
    images.forEach((img, idx) => {
      if (!isImageVisible(img)) return;
      if (!isFrameMemberVisible(img, { type: "image", index: idx })) return;
      if (!isImageNearViewport(img)) return;
      combined.push({
        type: "image",
        order: img.order ?? orderCounter + idx,
        index: idx,
        layer: img.layer || "base",
        isFrame: isFrameContainer(img),
      });
      if (isFrameContainer(img)) {
        combined.push({
          type: "frame-header",
          order: img.order ?? orderCounter + idx,
          index: idx,
          layer: img.layer || "base",
        });
      }
    });
    texts.forEach((t, idx) => {
      if (!isTextVisible(t)) return;
      const item = { type: "text", index: idx };
      if (!isFramedObjectNearViewport(t, item)) return;
      if (!isFrameMemberVisible(t, item)) return;
      combined.push({
        type: "text",
        order: t.order ?? strokes.length + idx,
        index: idx,
        layer: t.layer || "user",
      });
    });
    links.forEach((link, idx) => {
      if (!isLinkVisible(link)) return;
      if (!isWorldRectNearViewport(getLinkBoundsWorld(link), 512)) return;
      combined.push({
        type: "link",
        order: link.order ?? orderCounter + idx,
        index: idx,
        layer: link.layer || "user",
      });
    });
    combined.forEach((item) => {
      const draftBoardRenderInfo = getDraftBoardRenderInfo(item);
      if (draftBoardRenderInfo) {
        item.draftBoardGroupId = draftBoardRenderInfo.groupId;
        item.draftBoardGroupRank = draftBoardRenderInfo.rank;
        item.draftBoardGroupOrder = draftBoardRenderInfo.order;
        item.draftBoardGroupCreatedAt = draftBoardRenderInfo.createdAt;
      }

      if (item.type === "image") {
        const img = images[item.index];
        if (isFrameContainer(img)) {
          const owner = findOwningFrameForItem({ type: "image", index: item.index });
          if (owner) {
            item.frameGroupId = owner.frame.id;
            item.frameGroupOrder = owner.order;
            item.frameGroupRank = getFrameMemberDrawRank(img);
          } else {
            item.frameGroupId = img.id;
            item.frameGroupOrder = getFrameOrder(img);
            item.frameGroupRank = 0;
          }
        } else if (isOmoteUraTagImage(img)) {
          item.frameGroupId = img.id;
          item.frameGroupOrder = getObjectOrderValue("image", img, item.index);
          item.frameGroupRank = 0;
        } else {
          const owner = findOwningFrameForItem({ type: "image", index: item.index });
          if (owner) {
            item.frameGroupId = owner.frame.id;
            item.frameGroupOrder = owner.order;
            item.frameGroupRank = getFrameMemberDrawRank(images[item.index]);
          } else {
            const omoteUraOwner = findOwningOmoteUraFrameForImage(img);
            if (omoteUraOwner) {
              item.frameGroupId = omoteUraOwner.frame.id;
              item.frameGroupOrder = omoteUraOwner.order;
              item.frameGroupRank = 3;
            }
          }
        }
      } else if (item.type === "frame-header") {
        const img = images[item.index];
        if (isFrameContainer(img)) {
          item.frameGroupId = img.id;
          item.frameGroupOrder = getFrameOrder(img);
          item.frameGroupRank = 4;
          const owner = findOwningFrameForItem({ type: "image", index: item.index });
          item.frameUiClipFrameId = owner?.frame?.id || null;
        }
      } else if (item.type === "stroke") {
        const owner = findOwningFrameForItem({ type: "stroke", index: item.index });
        if (owner) {
          item.frameGroupId = owner.frame.id;
          item.frameGroupOrder = owner.order;
          item.frameGroupRank = getFrameMemberDrawRank(strokes[item.index]);
        }
      } else if (item.type === "draft-stroke") {
        const owner = findOwningFrameForItem({ type: "draft", index: item.index });
        if (owner) {
          item.frameGroupId = owner.frame.id;
          item.frameGroupOrder = owner.order;
          item.frameGroupRank = getFrameMemberDrawRank(draftStrokes[item.index]);
        }
      } else if (item.type === "text") {
        const owner = findOwningFrameForItem({ type: "text", index: item.index });
        if (owner) {
          item.frameGroupId = owner.frame.id;
          item.frameGroupOrder = owner.order;
          item.frameGroupRank = getFrameMemberDrawRank(texts[item.index]);
        }
      }
    });
    combined.sort((a, b) => {
      if (a.draftBoardGroupId && b.draftBoardGroupId && a.draftBoardGroupId === b.draftBoardGroupId) {
        const rankA = a.draftBoardGroupRank ?? 1;
        const rankB = b.draftBoardGroupRank ?? 1;
        if (rankA !== rankB) return rankA - rankB;
        const createdA = typeof a.draftBoardGroupCreatedAt === "number" ? a.draftBoardGroupCreatedAt : 0;
        const createdB = typeof b.draftBoardGroupCreatedAt === "number" ? b.draftBoardGroupCreatedAt : 0;
        if (createdA !== createdB) return createdA - createdB;
        const orderA = typeof a.draftBoardGroupOrder === "number" ? a.draftBoardGroupOrder : a.order ?? 0;
        const orderB = typeof b.draftBoardGroupOrder === "number" ? b.draftBoardGroupOrder : b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
      }
      if (a.frameGroupId || b.frameGroupId) {
        const groupA = typeof a.frameGroupOrder === "number" ? a.frameGroupOrder : a.order ?? 0;
        const groupB = typeof b.frameGroupOrder === "number" ? b.frameGroupOrder : b.order ?? 0;
        if (groupA !== groupB) return groupA - groupB;
        if (a.frameGroupId && b.frameGroupId && a.frameGroupId === b.frameGroupId) {
          const rankA = a.frameGroupRank ?? 1;
          const rankB = b.frameGroupRank ?? 1;
          if (rankA !== rankB) return rankA - rankB;
        }
      }
      const lpA = getRenderLayerPriority(a.layer || "user");
      const lpB = getRenderLayerPriority(b.layer || "user");
      if (lpA !== lpB) return lpA - lpB;
      const ordA = typeof a.order === "number" ? a.order : 0;
      const ordB = typeof b.order === "number" ? b.order : 0;
      return ordA - ordB;
    });

    const staticCacheKeys = drawStaticLayerCache(combined);

    ctx.textBaseline = "top";
    for (const item of combined) {
      if (staticCacheKeys.has(getRenderItemKey(item))) continue;
      const frameClipChain =
        item.type === "frame-header"
          ? getFrameRenderClipChainFromFrameId(item.frameUiClipFrameId)
          : getFrameRenderClipChainForItem(item);
      if (frameClipChain.length) {
        ctx.save();
        frameClipChain.forEach((frameClip) => {
          const clipPos = worldToScreen(frameClip.viewport.x, frameClip.viewport.y);
          ctx.beginPath();
          ctx.rect(
            clipPos.x,
            clipPos.y,
            frameClip.viewport.width * scale,
            frameClip.viewport.height * scale
          );
          ctx.clip();
        });
      }
      try {
      if (item.type === "image") {
        const imgObj = images[item.index];
        if (isBoardOverlayImage(imgObj)) {
          drawBoardOverlayImage(imgObj);
          if (selected && selected.type === "image" && selected.index === item.index) {
            drawSelectionBoundsWorld(
              { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
              0,
              false
            );
          }
          continue;
        }
        const imgEl = ensureImageElementForImage(imgObj);
        if (!imgObj || !imgEl || !imgEl.complete || imgEl.naturalWidth === 0 || imgEl.naturalHeight === 0) {
          continue;
        }
        const renderImg = imgObj.renderImg || imgEl;
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
              ctx.translate(p.x + w / 2, p.y + h / 2);
              if (imgObj.mirrored) ctx.scale(-1, 1);
              if (rotation) ctx.rotate((rotation * Math.PI) / 180);
              ctx.drawImage(renderImg, -w / 2, -h / 2, w, h);
            } finally {
              ctx.restore();
            }
            if (imgObj.mirrored) {
              if (!drawMirroredLassoImageGlow(imgObj)) {
                drawMirroredImageGlow(
                  { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
                  rotation
                );
              }
            }
          }
        } catch (err) {
          console.error("failed to draw image", imgObj?.id, err);
          continue;
        }
        if (selected && selected.type === "image" && selected.index === item.index) {
          if (!drawLassoImageSelectionBounds(imgObj)) {
            drawSelectionBoundsWorld(
              { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
              rotation
            );
          }
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
        const glowColor = getStrokeGlowColor(stroke);
        ctx.globalAlpha = strokesDimmed ? DIM_ALPHA : 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * scale; // ズームに合わせて太さを変える
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (glowColor) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = Math.max(3, Math.min(12, (stroke.size || 1) * scale * 1.6));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

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
        if (!isStrokeVisible(stroke)) continue;
        if (activeLayer !== "draft" && !(activeLayer === "user" && isOwnDraftBoardItem(stroke))) continue;
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
        ctx.globalAlpha = strokesDimmed ? DIM_ALPHA : 1;

        if (t.gridText) {
          const cell = fontSizePx;
          ctx.font = `${cell * 0.9}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          t.lines.forEach((line, lineIdx) => {
            Array.from(line || "").forEach((char, charIdx) => {
              if (char === " ") return;
              const x = base.x + (t.vertical ? lineIdx : charIdx) * cell + cell / 2;
              const y = base.y + (t.vertical ? charIdx : lineIdx) * cell + cell / 2;

              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, x, y);

              ctx.fillStyle = fillColor;
              ctx.fillText(char, x, y);
            });
          });
        } else if (t.vertical) {
          t.lines.forEach((line, lineIdx) => {
            const x = base.x + lineIdx * lineHeight;
            Array.from(line || "").forEach((char, charIdx) => {
              const y = base.y + charIdx * lineHeight;

              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, x, y);

              ctx.fillStyle = fillColor;
              ctx.fillText(char, x, y);
            });
          });
        } else {
          t.lines.forEach((line, idx) => {
            const y = base.y + idx * lineHeight;

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, base.x, y);

            ctx.fillStyle = fillColor;
            ctx.fillText(line, base.x, y);
          });
        }
        ctx.restore();

        if (textHasStarLabel(t)) {
          drawStarLabelBoundsWorld(bounds, rotation, t.color);
        }
        if (selected && selected.type === "text" && selected.index === item.index) {
          drawSelectionBoundsWorld(bounds, rotation);
        }
      } else if (item.type === "link") {
        const link = links[item.index];
        if (!link) continue;
        drawLinkCard(link);
        if (selected && selected.type === "link" && selected.index === item.index) {
          drawSelectionBoundsWorld(getLinkBoundsWorld(link), 0);
        }
      } else if (item.type === "frame-header") {
        const img = images[item.index];
        if (!isFrameContainer(img) || !isImageVisible(img)) continue;
        if (!isFrameMemberVisible(img, { type: "image", index: item.index })) continue;
        drawFrameHeaderOverlay(ctx, img);
      }
      } finally {
        if (frameClipChain.length) ctx.restore();
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
    if (linkBoardMode === "source" && linkBoardSourceStart && linkBoardSourcePreview) {
      const start = worldToScreen(linkBoardSourceStart.x, linkBoardSourceStart.y);
      const end = worldToScreen(linkBoardSourcePreview.x, linkBoardSourcePreview.y);
      drawLassoRectScreen(
        { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y },
        "#16a34a"
      );
    }
    if (linkBoardMode === "place" && pendingLinkBoardSource) {
      const startWorld = linkBoardPlaceStart || screenToWorld(lastMouseScreen.x, lastMouseScreen.y);
      const endWorld =
        linkBoardPlacePreview ||
        (linkBoardPlaceStart
          ? null
          : { x: startWorld.x + pendingLinkBoardSource.width, y: startWorld.y + pendingLinkBoardSource.height });
      if (startWorld && endWorld) {
        const start = worldToScreen(startWorld.x, startWorld.y);
        const end = worldToScreen(endWorld.x, endWorld.y);
        drawLassoRectScreen(
          { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y },
          "#f59e0b"
        );
      }
    }

    if (multiSelection && multiSelection.items) {
      drawMultiSelectionItemBounds(multiSelection.items);
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
    if (lassoCopyActive && lassoCopyPath.length > 1) {
      if (lassoCopyMode === "rect") {
        drawLassoRectScreen(
          {
            x: lassoCopyPath[0].x,
            y: lassoCopyPath[0].y,
            width: lassoCopyPath[1].x - lassoCopyPath[0].x,
            height: lassoCopyPath[1].y - lassoCopyPath[0].y,
          },
          "#d97706"
        );
      } else {
        drawLassoPathScreen(lassoCopyPath, "#d97706");
      }
    }
    if (lassoCopySelection) {
      const path = getLassoSelectionScreenPath();
      if (lassoCopySelection.mode === "rect") {
        drawLassoRectScreen(getPathBoundsScreen(path), "#d97706");
      } else {
        drawLassoPathScreen(path, "#d97706");
      }
    }

    // 3. 最前面オーバーレイ：レーザーポインタ／記入中ラベル
    drawAttentionPointers();
    drawWritingLabels();
    frameRenderCache = null;
    emitCurrentViewPresence();
  }

  function getRenderItemKey(item) {
    if (!item) return "";
    const obj = item.type === "image" ? images[item.index] : null;
    return obj?.id ? `${item.type}:${obj.id}` : `${item.type}:${item.index}`;
  }

  function isStaticLayerCacheItem(item) {
    if (item?.type !== "image") return false;
    const imgObj = images[item.index];
    if (!imgObj || imgObj.tagType || imgObj.frameId || isBoardOverlayImage(imgObj)) return false;
    if (selected?.type === "image" && selected.index === item.index) return false;
    const layer = imgObj.layer || "base";
    return layer === "image" || layer === "base";
  }

  function buildStaticLayerCacheSignature(items) {
    return [
      canvas.width,
      canvas.height,
      scale,
      offsetX,
      offsetY,
      ...items.map(({ item, imgObj }) =>
        [
          getRenderItemKey(item),
          imgObj.src,
          imgObj.x,
          imgObj.y,
          imgObj.width,
          imgObj.height,
          imgObj.rotation || 0,
          imgObj.mirrored ? 1 : 0,
        ].join(":")
      ),
    ].join("|");
  }

  function drawStaticLayerCache(combined) {
    const candidates = [];
    combined.forEach((item) => {
      if (!isStaticLayerCacheItem(item)) return;
      const imgObj = images[item.index];
      const imgEl = ensureImageElementForImage(imgObj);
      if (!imgEl?.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
      candidates.push({ item, imgObj });
    });
    if (!candidates.length) return new Set();

    const signature = buildStaticLayerCacheSignature(candidates);
    if (
      !staticLayerCache ||
      staticLayerCache.signature !== signature ||
      staticLayerCache.canvas.width !== canvas.width ||
      staticLayerCache.canvas.height !== canvas.height
    ) {
      const cacheCanvas = staticLayerCache?.canvas || document.createElement("canvas");
      cacheCanvas.width = canvas.width;
      cacheCanvas.height = canvas.height;
      const cacheCtx = cacheCanvas.getContext("2d");
      cacheCtx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
      candidates.forEach(({ imgObj }) => {
        const imgEl = imgObj.renderImg || imgObj.img;
        if (!imgEl) return;
        const p = worldToScreen(imgObj.x, imgObj.y);
        const w = imgObj.width * scale;
        const h = imgObj.height * scale;
        const rotation = normalizeRotation(imgObj.rotation || 0);
        cacheCtx.save();
        cacheCtx.translate(p.x + w / 2, p.y + h / 2);
        if (imgObj.mirrored) cacheCtx.scale(-1, 1);
        if (rotation) cacheCtx.rotate((rotation * Math.PI) / 180);
        cacheCtx.drawImage(imgEl, -w / 2, -h / 2, w, h);
        cacheCtx.restore();
      });
      staticLayerCache = { canvas: cacheCanvas, signature };
    }

    ctx.drawImage(staticLayerCache.canvas, 0, 0);
    return new Set(candidates.map(({ item }) => getRenderItemKey(item)));
  }

  function drawSelectionRect(x, y, w, h, showHandles = true) {
    ctx.save();
    ctx.strokeStyle = "#0078d7";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    if (!showHandles) {
      ctx.restore();
      return;
    }

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

  function drawSelectionBoundsWorld(bounds, rotation = 0, showHandles = true) {
    const normalizedRotation = normalizeRotation(rotation);
    if (!normalizedRotation) {
      const p = worldToScreen(bounds.x, bounds.y);
      drawSelectionRect(p.x, p.y, bounds.width * scale, bounds.height * scale, showHandles);
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

    if (showHandles) {
      const handleSize = 8;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0078d7";
      corners.forEach((corner) => {
        ctx.beginPath();
        ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function getLassoOutlineWorldPoints(imgObj) {
    if (!imgObj || !Array.isArray(imgObj.lassoOutlinePath) || imgObj.lassoOutlinePath.length < 3) return [];
    const center = {
      x: imgObj.x + imgObj.width / 2,
      y: imgObj.y + imgObj.height / 2,
    };
    const rotation = normalizeRotation(imgObj.rotation || 0);
    return imgObj.lassoOutlinePath.map((point) => {
      const px = typeof point.x === "number" ? point.x : 0;
      const py = typeof point.y === "number" ? point.y : 0;
      const local = {
        x: imgObj.x + (imgObj.mirrored ? 1 - px : px) * imgObj.width,
        y: imgObj.y + py * imgObj.height,
      };
      return rotation ? rotatePointByDegrees(local, center, rotation) : local;
    });
  }

  function drawLassoImageSelectionBounds(imgObj) {
    const points = getLassoOutlineWorldPoints(imgObj).map((p) => worldToScreen(p.x, p.y));
    if (points.length < 3) return false;
    ctx.save();
    ctx.strokeStyle = "#0078d7";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function drawMirroredLassoImageGlow(imgObj) {
    if (!imgObj?.mirrored) return false;
    const points = getLassoOutlineWorldPoints(imgObj).map((p) => worldToScreen(p.x, p.y));
    if (points.length < 3) return false;
    const strokePath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = "#22a7ff";
    ctx.shadowColor = "rgba(34, 167, 255, 0.95)";
    ctx.shadowBlur = Math.max(10, 14 * scale);
    ctx.lineWidth = Math.max(3, 4 * scale);
    strokePath();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = "#d8f1ff";
    strokePath();
    ctx.restore();
    return true;
  }

  function drawStarLabelBoundsWorld(bounds, rotation = 0, color = "#111827") {
    if (!bounds) return;
    const padding = Math.max(3, 4 * scale);
    const normalizedRotation = normalizeRotation(rotation);
    ctx.save();
    ctx.strokeStyle = normalizeHexColor(color || "#111827");
    ctx.lineWidth = Math.max(1.5, 2 * Math.min(scale, 1.5));
    ctx.setLineDash([]);
    if (!normalizedRotation) {
      const p = worldToScreen(bounds.x, bounds.y);
      ctx.strokeRect(
        p.x - padding,
        p.y - padding,
        bounds.width * scale + padding * 2,
        bounds.height * scale + padding * 2
      );
      ctx.restore();
      return;
    }

    const expanded = {
      x: bounds.x - padding / scale,
      y: bounds.y - padding / scale,
      width: bounds.width + (padding * 2) / scale,
      height: bounds.height + (padding * 2) / scale,
    };
    const corners = getRotatedRectCornersWorld(expanded, normalizedRotation).map((p) =>
      worldToScreen(p.x, p.y)
    );
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawMirroredImageGlow(bounds, rotation = 0) {
    const p = worldToScreen(bounds.x, bounds.y);
    const w = bounds.width * scale;
    const h = bounds.height * scale;
    ctx.save();
    ctx.translate(p.x + w / 2, p.y + h / 2);
    ctx.scale(-1, 1);
    const normalizedRotation = normalizeRotation(rotation);
    if (normalizedRotation) ctx.rotate((normalizedRotation * Math.PI) / 180);
    ctx.strokeStyle = "#22a7ff";
    ctx.shadowColor = "rgba(34, 167, 255, 0.95)";
    ctx.shadowBlur = Math.max(10, 14 * scale);
    ctx.lineWidth = Math.max(3, 4 * scale);
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = "#d8f1ff";
    ctx.stroke();
    ctx.restore();
  }

  function drawBoardOverlayImage(imgObj) {
    if (isDraftBoardImage(imgObj)) {
      drawDraftBoardImage(imgObj);
      return;
    }
    drawLinkedBoardImage(imgObj);
  }

  function drawDraftBoardImage(imgObj) {
    const src = imgObj?.draftBoardSource;
    if (!src || !imgObj.width || !imgObj.height) return;
    const dest = worldToScreen(imgObj.x, imgObj.y);
    const destW = imgObj.width * scale;
    const destH = imgObj.height * scale;
    const headerH = Math.min(destH, Math.max(18, Math.min(22, (src.headerHeight || 0) * scale || 20)));

    ctx.save();
    ctx.fillStyle = "rgba(239, 246, 255, 0.72)";
    ctx.fillRect(dest.x, dest.y, destW, destH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.fillRect(dest.x, dest.y, destW, headerH);
    ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.shadowColor = "rgba(59, 130, 246, 0.85)";
    ctx.shadowBlur = 12;
    ctx.strokeRect(dest.x, dest.y, destW, destH);
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dest.x, dest.y + headerH);
    ctx.lineTo(dest.x + destW, dest.y + headerH);
    ctx.stroke();
    ctx.fillStyle = "rgba(30, 64, 175, 0.98)";
    ctx.font = "12px sans-serif";
    ctx.fillText("下書きボード", dest.x + 10, dest.y + Math.max(4, (headerH - 14) / 2));
    ctx.restore();
  }

  function drawLinkedBoardImage(imgObj) {
    const src = imgObj?.linkBoardSource;
    if (!src || !src.width || !src.height || !imgObj.width || !imgObj.height) return;
    const dest = worldToScreen(imgObj.x, imgObj.y);
    const destW = imgObj.width * scale;
    const destH = imgObj.height * scale;
    const ratioX = destW / src.width;
    const ratioY = destH / src.height;
    const ratio = Math.min(ratioX, ratioY);
    const mapPoint = (p) => ({
      x: dest.x + (p.x - src.x) * ratioX,
      y: dest.y + (p.y - src.y) * ratioY,
    });

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(dest.x, dest.y, destW, destH);
    ctx.beginPath();
    ctx.rect(dest.x, dest.y, destW, destH);
    ctx.clip();

    images.forEach((child) => {
      if (!child || child.id === imgObj.id || isBoardOverlayImage(child) || !isImageVisible(child)) return;
      const bounds = getImageBoundsWorld(child);
      if (!bounds || !rectsOverlap(src, bounds)) return;
      const imgEl = ensureImageElementForImage(child);
      if (!imgEl?.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
      const p = mapPoint({ x: child.x, y: child.y });
      const w = child.width * ratioX;
      const h = child.height * ratioY;
      ctx.save();
      ctx.translate(p.x + w / 2, p.y + h / 2);
      if (child.mirrored) ctx.scale(-1, 1);
      const rotation = normalizeRotation(child.rotation || 0);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(child.renderImg || imgEl, -w / 2, -h / 2, w, h);
      ctx.restore();
    });

    strokes.forEach((stroke) => {
      if (!stroke || !isStrokeVisible(stroke)) return;
      const bounds = getStrokeBoundsWorld(stroke);
      if (!bounds || !rectsOverlap(src, bounds)) return;
      if (stroke.fill && stroke.points.length >= 3) {
        ctx.save();
        ctx.fillStyle = stroke.color || withAlpha(currentColor, 0.38);
        ctx.beginPath();
        const first = mapPoint(stroke.points[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = mapPoint(stroke.points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }
      if (!stroke.points?.length) return;
      ctx.save();
      const glowColor = getStrokeGlowColor(stroke);
      ctx.globalAlpha = strokesDimmed ? DIM_ALPHA : 1;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, (stroke.size || 1) * ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = Math.max(2, Math.min(8, (stroke.size || 1) * ratio * 1.2));
      }
      ctx.beginPath();
      const first = mapPoint(stroke.points[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = mapPoint(stroke.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    });

    texts.forEach((t) => {
      if (!t || !isTextVisible(t)) return;
      const bounds = getTextBoundsWorld(t);
      if (!bounds || !rectsOverlap(src, bounds)) return;
      const p = mapPoint({ x: t.x, y: t.y });
      const fontSizePx = Math.max(4, (t.fontSize || 16) * ratio);
      const lineHeight = fontSizePx * 1.2;
      const baseColor = normalizeHexColor(t.color || "#000000");
      ctx.save();
      ctx.font = `${fontSizePx}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, fontSizePx * 0.15);
      ctx.fillStyle = lightenColor(baseColor);
      (t.lines || [""]).forEach((line, idx) => {
        const y = p.y + idx * lineHeight;
        ctx.strokeText(line, p.x, y);
        ctx.fillText(line, p.x, y);
      });
      ctx.restore();
    });

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(dest.x, dest.y, destW, destH);
    const label = getLinkedBoardLabelBoundsScreen(imgObj);
    if (label) {
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(label.x, label.y, label.width, label.height);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(label.x, label.y, label.width, label.height);
    }
    ctx.fillStyle = "rgba(146, 64, 14, 0.95)";
    ctx.font = "12px sans-serif";
    ctx.fillText("LINK", dest.x + 12, dest.y + 10);
    ctx.restore();
  }

  function getSelectionItemBoundsWorld(item) {
    if (!item) return null;
    if (item.type === "image") {
      const img = images[item.index];
      if (!img) return null;
      return {
        bounds: { x: img.x, y: img.y, width: img.width, height: img.height },
        rotation: img.rotation || 0,
      };
    }
    if (item.type === "text") {
      const text = texts[item.index];
      if (!text) return null;
      return { bounds: getTextBoundsWorld(text), rotation: text.rotation || 0 };
    }
    if (item.type === "link") {
      const link = links[item.index];
      if (!link) return null;
      return { bounds: getLinkBoundsWorld(link), rotation: 0 };
    }
    if (item.type === "stroke") {
      const stroke = strokes[item.index];
      return { bounds: getStrokeBoundsWorld(stroke), rotation: 0 };
    }
    if (item.type === "draft") {
      const stroke = draftStrokes[item.index];
      return { bounds: getStrokeBoundsWorld(stroke), rotation: 0 };
    }
    if (item.type === "stroke-group") {
      const bounds = getSelectionWorldBounds(item.indices.map((idx) => ({ type: "stroke", index: idx })));
      return { bounds, rotation: 0 };
    }
    if (item.type === "draft-group") {
      const bounds = getSelectionWorldBounds(item.indices.map((idx) => ({ type: "draft", index: idx })));
      return { bounds, rotation: 0 };
    }
    return null;
  }

  function drawMultiSelectionItemBounds(items) {
    (items || []).forEach((item) => {
      if (item?.type === "image") {
        const imgObj = images[item.index];
        if (drawLassoImageSelectionBounds(imgObj)) return;
      }
      const resolved = getSelectionItemBoundsWorld(item);
      if (!resolved || !resolved.bounds) return;
      drawSelectionBoundsWorld(resolved.bounds, resolved.rotation || 0);
    });
  }

  function getResizeHandlesScreen(bounds, rotation = 0) {
    if (!bounds) return [];
    const corners = getRotatedRectCornersWorld(bounds, rotation).map((p) =>
      worldToScreen(p.x, p.y)
    );
    return [
      { handle: "tl", ...corners[0] },
      { handle: "tr", ...corners[1] },
      { handle: "br", ...corners[2] },
      { handle: "bl", ...corners[3] },
    ];
  }

  function hitTestResizeHandlesScreen(screenX, screenY, bounds, rotation = 0, radius = 12) {
    const handles = getResizeHandlesScreen(bounds, rotation);
    for (const hpos of handles) {
      const dx = screenX - hpos.x;
      const dy = screenY - hpos.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return hpos;
      }
    }
    return null;
  }

  function hitTestMultiSelectionResizeHandle(screenX, screenY, radius = 12) {
    if (!multiSelection || !multiSelection.items) return null;
    for (let i = multiSelection.items.length - 1; i >= 0; i--) {
      const item = multiSelection.items[i];
      const resolved = getSelectionItemBoundsWorld(item);
      if (!resolved || !resolved.bounds) continue;
      const hit = hitTestResizeHandlesScreen(
        screenX,
        screenY,
        resolved.bounds,
        resolved.rotation || 0,
        radius
      );
      if (hit) {
        return { item, handle: hit.handle };
      }
    }
    return null;
  }

  function getResizeAnchorForHandle(bounds, handle) {
    if (!bounds) return null;
    if (handle === "tl") return { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
    if (handle === "tr") return { x: bounds.x, y: bounds.y + bounds.height };
    if (handle === "bl") return { x: bounds.x + bounds.width, y: bounds.y };
    return { x: bounds.x, y: bounds.y };
  }

  function captureMultiResizeItems(items) {
    const captured = [];
    const seen = new Set();
    const addStroke = (idx) => {
      const s = strokes[idx];
      if (!s || seen.has(`stroke:${s.id || idx}`)) return;
      seen.add(`stroke:${s.id || idx}`);
      captured.push({
        type: "stroke",
        index: idx,
        points: s.points.map((p) => ({ x: p.x, y: p.y })),
      });
    };
    const addDraft = (idx) => {
      const s = draftStrokes[idx];
      if (!s || seen.has(`draft:${s.id || idx}`)) return;
      seen.add(`draft:${s.id || idx}`);
      captured.push({
        type: "draft",
        index: idx,
        points: s.points.map((p) => ({ x: p.x, y: p.y })),
      });
    };

    (items || []).forEach((item) => {
      if (!item) return;
      if (item.type === "stroke") {
        addStroke(item.index);
      } else if (item.type === "stroke-group") {
        item.indices.forEach(addStroke);
      } else if (item.type === "draft") {
        addDraft(item.index);
      } else if (item.type === "draft-group") {
        item.indices.forEach(addDraft);
      } else if (item.type === "text") {
        const t = texts[item.index];
        if (!t || seen.has(`text:${t.id || item.index}`)) return;
        seen.add(`text:${t.id || item.index}`);
        captured.push({
          type: "text",
          index: item.index,
          x: t.x,
          y: t.y,
          fontSize: t.fontSize,
        });
      } else if (item.type === "image") {
        const img = images[item.index];
        if (!img || seen.has(`image:${img.id || item.index}`)) return;
        if (isBoardOverlayImage(img)) return;
        seen.add(`image:${img.id || item.index}`);
        captured.push({
          type: "image",
          index: item.index,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
        });
      }
    });
    return captured;
  }

  function scalePointFromAnchor(point, anchor, factor) {
    return {
      x: anchor.x + (point.x - anchor.x) * factor,
      y: anchor.y + (point.y - anchor.y) * factor,
    };
  }

  function applyMultiResize(resize, worldPos) {
    if (!resize || resize.type !== "multi" || !resize.items?.length) return;
    const anchor = { x: resize.anchorX, y: resize.anchorY };
    const currentDistance = Math.hypot(worldPos.x - anchor.x, worldPos.y - anchor.y);
    const factor = Math.max(currentDistance / Math.max(resize.startDistance || 1, 1), 0.05);

    resize.items.forEach((it) => {
      if (it.type === "stroke") {
        const s = strokes[it.index];
        if (!s || !it.points) return;
        s.points = it.points.map((p) => scalePointFromAnchor(p, anchor, factor));
      } else if (it.type === "draft") {
        const s = draftStrokes[it.index];
        if (!s || !it.points) return;
        s.points = it.points.map((p) => scalePointFromAnchor(p, anchor, factor));
      } else if (it.type === "text") {
        const t = texts[it.index];
        if (!t) return;
        const pos = scalePointFromAnchor({ x: it.x, y: it.y }, anchor, factor);
        t.x = pos.x;
        t.y = pos.y;
        t.fontSize = Math.max((it.fontSize || 1) * factor, 1);
      } else if (it.type === "image") {
        const img = images[it.index];
        if (!img) return;
        const pos = scalePointFromAnchor({ x: it.x, y: it.y }, anchor, factor);
        img.x = pos.x;
        img.y = pos.y;
        img.width = Math.max((it.width || 1) * factor, 1);
        img.height = Math.max((it.height || 1) * factor, 1);
      }
    });

    if (multiSelection) {
      multiSelection.rectWorld = getSelectionWorldBounds(multiSelection.items);
    }
  }

  function emitMultiResizeUpdates(items) {
    if (!socketConnected) return;
    (items || []).forEach((it) => {
      if (it.type === "stroke") {
        const s = strokes[it.index];
        if (!s) return;
        socket.emit("item:update", {
          boardId,
          type: "stroke",
          id: s.id,
          patch: { points: s.points.map((p) => ({ x: p.x, y: p.y })) },
        });
      } else if (it.type === "draft") {
        const s = draftStrokes[it.index];
        if (s) socket.emit("draft:stroke:add", { boardId, stroke: s });
      } else if (it.type === "text") {
        const t = texts[it.index];
        if (!t) return;
        socket.emit("item:update", {
          boardId,
          type: "text",
          id: t.id,
          patch: { x: t.x, y: t.y, fontSize: t.fontSize },
        });
      } else if (it.type === "image") {
        const img = images[it.index];
        if (!img) return;
        socket.emit("item:update", {
          boardId,
          type: "image",
          id: img.id,
          patch: { x: img.x, y: img.y, width: img.width, height: img.height },
        });
      }
    });
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

  function getPathBoundsScreen(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((p) => {
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function drawLassoPathScreen(points, color = "#d97706") {
    if (!Array.isArray(points) || points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function clearLassoCopySelection() {
    lassoCopySelection = null;
    lassoCopyActive = false;
    lassoCopyPath = [];
  }

  function getLassoSelectionScreenPath(selection = lassoCopySelection) {
    if (!selection || !Array.isArray(selection.worldPath)) return [];
    return selection.worldPath.map((p) => worldToScreen(p.x, p.y));
  }

  function makeRectPathScreen(a, b) {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const right = Math.max(a.x, b.x);
    const bottom = Math.max(a.y, b.y);
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }

  function createLassoCopySelectionFromScreenPath(path, mode = lassoCopyMode) {
    const cleaned = (path || []).filter((p) => p && typeof p.x === "number" && typeof p.y === "number");
    if (cleaned.length < 3) return false;
    const screenBounds = getPathBoundsScreen(cleaned);
    if (!screenBounds || screenBounds.width < 4 || screenBounds.height < 4) return false;
    const worldPath = cleaned.map((p) => screenToWorld(p.x, p.y));
    const worldBounds = getPathBoundsScreen(worldPath);
    if (!worldBounds || worldBounds.width <= 0 || worldBounds.height <= 0) return false;
    lassoCopySelection = { mode, worldPath, worldBounds };
    selected = null;
    multiSelection = null;
    updateToolButtons();
    updateFooterByState();
    redraw();
    return true;
  }

  function pointInPolygonScreen(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const pi = polygon[i];
      const pj = polygon[j];
      const intersects =
        pi.y > point.y !== pj.y > point.y &&
        point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 0.000001) + pi.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function hitTestLassoCopySelectionScreen(screenPoint) {
    if (!lassoCopySelection) return false;
    const path = getLassoSelectionScreenPath();
    const bounds = getPathBoundsScreen(path);
    if (!bounds || !pointInRectWorld(bounds, screenPoint)) return false;
    if (lassoCopySelection.mode === "rect") return true;
    return pointInPolygonScreen(screenPoint, path);
  }

  function buildRelativeLassoOutlinePath(worldPath, worldBounds) {
    if (!Array.isArray(worldPath) || worldPath.length < 3 || !worldBounds?.width || !worldBounds?.height) return null;
    return worldPath
      .filter((point) => point && typeof point.x === "number" && typeof point.y === "number")
      .map((point) => ({
        x: (point.x - worldBounds.x) / worldBounds.width,
        y: (point.y - worldBounds.y) / worldBounds.height,
      }));
  }

  function copyLassoCopySelection() {
    if (!lassoCopySelection) return;
    const mode = lassoCopySelection.mode;
    const path = getLassoSelectionScreenPath();
    const lassoOutlinePath =
      mode === "rect" ? null : buildRelativeLassoOutlinePath(lassoCopySelection.worldPath, lassoCopySelection.worldBounds);
    clearLassoCopySelection();
    createImageFromLassoPath(path, mode, { lassoOutlinePath });
  }

  function createLinkedBoardFromLassoCopySelection() {
    if (!lassoCopySelection?.worldBounds) return;
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    const source = { ...lassoCopySelection.worldBounds };
    const offsetWorld = 24 / Math.max(scale, 0.001);
    const dest = {
      x: source.x + offsetWorld,
      y: source.y + offsetWorld,
      width: source.width,
      height: source.height,
    };
    clearLassoCopySelection();
    createLinkedBoardAt(source, dest, { lassoToolObject: true });
  }

  function mapRectPointBetweenRects(point, source, dest) {
    return {
      x: dest.x + ((point.x - source.x) / source.width) * dest.width,
      y: dest.y + ((point.y - source.y) / source.height) * dest.height,
    };
  }

  function mapRectBetweenRects(rect, source, dest) {
    const p = mapRectPointBetweenRects({ x: rect.x, y: rect.y }, source, dest);
    return {
      x: p.x,
      y: p.y,
      width: (rect.width / source.width) * dest.width,
      height: (rect.height / source.height) * dest.height,
    };
  }

  function createCroppedDraftBoardImage(sourceImg, cropWorldRect, sourceRect, destRect, draftBoardId) {
    if (!sourceImg || !cropWorldRect || !sourceRect || !destRect || !draftBoardId) return null;
    if (isFrameContainer(sourceImg) || isBoardOverlayImage(sourceImg)) return null;
    if (normalizeRotation(sourceImg.rotation || 0) !== 0) return null;
    const sourceEl = ensureImageElementForImage(sourceImg);
    if (!sourceEl?.complete || !sourceEl.naturalWidth || !sourceEl.naturalHeight) return null;
    const sourceBounds = getImageBoundsWorld(sourceImg);
    if (!sourceBounds || sourceBounds.width <= 0 || sourceBounds.height <= 0) return null;
    const scaleX = sourceEl.naturalWidth / sourceBounds.width;
    const scaleY = sourceEl.naturalHeight / sourceBounds.height;
    const sx = Math.max(0, Math.round((cropWorldRect.x - sourceBounds.x) * scaleX));
    const sy = Math.max(0, Math.round((cropWorldRect.y - sourceBounds.y) * scaleY));
    const sw = Math.min(sourceEl.naturalWidth - sx, Math.round(cropWorldRect.width * scaleX));
    const sh = Math.min(sourceEl.naturalHeight - sy, Math.round(cropWorldRect.height * scaleY));
    if (sw <= 0 || sh <= 0) return null;
    try {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, sw, sh);
      const src = cropCanvas.toDataURL("image/png");
      const img = new Image();
      const mapped = mapRectBetweenRects(cropWorldRect, sourceRect, destRect);
      const clone = {
        id: genId(),
        img,
        src,
        x: mapped.x,
        y: mapped.y,
        width: mapped.width,
        height: mapped.height,
        layer: "draft",
        order: orderCounter++,
        user: currentUser,
        rotation: 0,
        mirrored: false,
        imageName: sourceImg.imageName ? `${sourceImg.imageName} 下書き` : "下書き画像",
        imageListOrder: bumpImageListOrderCounter(),
        draftBoardId,
      };
      img.onload = () => redraw();
      img.src = src;
      return clone;
    } catch (err) {
      console.error("failed to crop draft board image", err);
      return null;
    }
  }

  function createDraftBoardFromLassoCopySelection() {
    if (!lassoCopySelection?.worldBounds) return;
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    const source = { ...lassoCopySelection.worldBounds };
    if (source.width < 8 || source.height < 8) return;
    ensureSnapshotForAction();
    const offsetWorld = 24 / Math.max(scale, 0.001);
    const headerHeightWorld = 22 / Math.max(scale, 0.001);
    const dest = {
      x: source.x + offsetWorld,
      y: source.y + offsetWorld - headerHeightWorld,
      width: source.width,
      height: source.height + headerHeightWorld,
    };
    const contentDest = {
      x: dest.x,
      y: dest.y + headerHeightWorld,
      width: source.width,
      height: source.height,
    };
    const boardIdForDraft = genId();
    const originalObjectIds = [];
    const boardImg = {
      id: boardIdForDraft,
      img: null,
      src: TRANSPARENT_PIXEL_SRC,
      x: dest.x,
      y: dest.y,
      width: dest.width,
      height: dest.height,
      layer: "draft",
      order: -1000000000 + orderCounter++,
      user: currentUser,
      rotation: 0,
      imageName: "下書きボード",
      imageListOrder: bumpImageListOrderCounter(),
      lassoToolObject: true,
      draftBoardSource: {
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
        headerHeight: headerHeightWorld,
        originalObjectIds,
        newObjectIds: [],
        floating: true,
      },
    };
    images.push(boardImg);
    registerUser(currentUser);

    const groupIds = new Map();
    const getDraftGroupId = (groupId) => {
      if (!groupId) return null;
      if (!groupIds.has(groupId)) groupIds.set(groupId, genId());
      return groupIds.get(groupId);
    };
    const copyStroke = (stroke) => {
      if (!stroke || !isStrokeVisible(stroke)) return false;
      const bounds = getStrokeBoundsWorld(stroke);
      if (!bounds || !rectContainsRect(source, bounds)) return false;
      const draft = {
        id: genId(),
        color: stroke.color || currentColor,
        size: stroke.size || currentSize,
        points: (stroke.points || []).map((p) => mapRectPointBetweenRects(p, source, contentDest)),
        user: currentUser,
        order: draftOrderCounter++,
        createdAt: Date.now(),
        fill: !!stroke.fill,
        groupId: getDraftGroupId(stroke.groupId),
        draftBoardId: boardIdForDraft,
      };
      draftStrokes.push(draft);
      originalObjectIds.push(draft.id);
      if (socketConnected) socket.emit("draft:stroke:add", { boardId, stroke: draft });
      return true;
    };
    strokes.slice().forEach(copyStroke);

    texts.slice().forEach((text) => {
      if (!text || !isTextVisible(text)) return;
      const bounds = getTextBoundsWorld(text);
      if (!bounds || !rectContainsRect(source, bounds)) return;
      const p = mapRectPointBetweenRects({ x: text.x, y: text.y }, source, contentDest);
      const clone = {
        ...text,
        id: genId(),
        lines: Array.isArray(text.lines) ? text.lines.slice() : text.lines,
        x: p.x,
        y: p.y,
        fontSize: (text.fontSize || 16) * (contentDest.height / source.height),
        layer: "draft",
        user: currentUser,
        order: orderCounter++,
        createdAt: Date.now(),
        textListOrder: bumpTextListOrderCounter(),
        frameId: null,
        frameTab: null,
        draftBoardId: boardIdForDraft,
      };
      texts.push(clone);
      originalObjectIds.push(clone.id);
      emitTextAdd(clone);
    });

    images.slice().forEach((img) => {
      if (!img || img.id === boardIdForDraft || isFrameContainer(img) || isBoardOverlayImage(img)) return;
      if (!isImageVisible(img)) return;
      const bounds = getImageBoundsWorld(img);
      if (!bounds || !rectsOverlap(source, bounds)) return;
      let clone = null;
      if (rectContainsRect(source, bounds)) {
        const mapped = mapRectBetweenRects(bounds, source, contentDest);
        clone = {
          ...img,
          id: genId(),
          x: mapped.x,
          y: mapped.y,
          width: mapped.width,
          height: mapped.height,
          layer: "draft",
          order: orderCounter++,
          user: currentUser,
          frameId: null,
          frameTab: null,
          imageName: img.imageName ? `${img.imageName} 下書き` : "",
          imageListOrder: bumpImageListOrderCounter(),
          draftBoardId: boardIdForDraft,
          linkBoardSource: img.linkBoardSource ? { ...img.linkBoardSource } : img.linkBoardSource,
          draftBoardSource: null,
        };
      } else {
        const cropWorldRect = getRectIntersection(source, bounds);
        clone = createCroppedDraftBoardImage(img, cropWorldRect, source, contentDest, boardIdForDraft);
      }
      if (!clone) return;
      images.push(clone);
      originalObjectIds.push(clone.id);
      emitImageAdd(clone);
    });

    boardImg.draftBoardSource = {
      ...boardImg.draftBoardSource,
      originalObjectIds: originalObjectIds.slice(),
    };
    emitImageAdd(boardImg);

    refreshTextList();
    refreshImageList();
    clearLassoCopySelection();
    const boardIndex = findIndexById(images, boardIdForDraft);
    selected = boardIndex >= 0 ? { type: "image", index: boardIndex } : null;
    multiSelection = null;
    showTransientFooterMessage("下書きボードを開きました。メインのツールバーで書き込めます。", 4000);
    updateToolButtons();
    redraw();
    openFloatingDraftBoard(boardImg);
  }

  function publishDraftBoard(imgObj, publishTargetRect = null, options = {}) {
    if (!imgObj || !isDraftBoardImage(imgObj) || imgObj.user !== currentUser) return;
    ensureSnapshotForAction();
    const draftBoardId = imgObj.id;
    const boardRect = getImageBoundsWorld(imgObj);
    const onlyNew = !!options.onlyNew;
    const publishOwner = options.owner || currentUser;
    const publishGlowColor = options.glowColor || getUserRegisteredFavoriteColor(publishOwner) || null;
    const originalObjectIds = Array.isArray(options.originalObjectIds)
      ? new Set(options.originalObjectIds)
      : inferDraftBoardOriginalIds(imgObj);
    const newObjectIds = new Set(imgObj.draftBoardSource?.newObjectIds || []);
    const headerHeight = imgObj.draftBoardSource?.headerHeight || 0;
    const sourceRect = onlyNew
      ? {
          x: boardRect.x,
          y: boardRect.y + headerHeight,
          width: boardRect.width,
          height: Math.max(1, boardRect.height - headerHeight),
        }
      : boardRect;
    const linkedSource = imgObj.draftBoardSource;
    const targetRect =
      publishTargetRect && publishTargetRect.width > 0 && publishTargetRect.height > 0
        ? getNormalizedRect(publishTargetRect)
        : onlyNew && linkedSource?.width > 0 && linkedSource?.height > 0
        ? {
            x: linkedSource.x,
            y: linkedSource.y,
            width: linkedSource.width,
            height: linkedSource.height,
          }
        : sourceRect;
    const mapPublishedPoint = (point) => mapRectPointBetweenRects(point, sourceRect, targetRect);
    const sizeScale = Math.min(targetRect.width / sourceRect.width, targetRect.height / sourceRect.height);
    const allDraftTargets = draftStrokes.filter((stroke) => stroke?.draftBoardId === draftBoardId && stroke.user === currentUser);
    const draftTargets = onlyNew
      ? allDraftTargets.filter((stroke) => newObjectIds.has(stroke.id))
      : allDraftTargets;
    allDraftTargets.forEach((draft) => {
      const stroke = {
        id: genId(),
        color: draft.color,
        size: (draft.size || 1) * sizeScale,
        points: (draft.points || []).map(mapPublishedPoint),
        user: publishOwner,
        layer: "user",
        order: orderCounter++,
        fill: !!draft.fill,
        groupId: draft.groupId || null,
        glowColor: publishGlowColor,
      };
      strokes.push(stroke);
      emitStrokeAdd(stroke);
    });
    draftTargets.forEach((draft) => {
      const idx = findIndexById(draftStrokes, draft.id);
      if (idx >= 0) draftStrokes.splice(idx, 1);
      if (socketConnected) socket.emit("draft:stroke:remove", { boardId, id: draft.id });
    });

    texts.slice().forEach((text) => {
      if (!text || text.draftBoardId !== draftBoardId || text.user !== currentUser) return;
      if (onlyNew && !newObjectIds.has(text.id)) {
        const index = findIndexById(texts, text.id);
        if (index >= 0) texts.splice(index, 1);
        if (socketConnected) socket.emit("item:remove", { boardId, type: "text", id: text.id });
        return;
      }
      const mapped = mapPublishedPoint({ x: text.x, y: text.y });
      text.x = mapped.x;
      text.y = mapped.y;
      text.fontSize = (text.fontSize || 16) * sizeScale;
      text.user = publishOwner;
      text.layer = "user";
      text.draftBoardId = null;
      emitItemPatch("text", text, {
        x: text.x,
        y: text.y,
        fontSize: text.fontSize,
        user: text.user,
        layer: "user",
        draftBoardId: null,
      });
    });
    images.slice().forEach((img) => {
      if (!img || img.id === draftBoardId || img.draftBoardId !== draftBoardId || img.user !== currentUser) return;
      if (onlyNew && !newObjectIds.has(img.id)) {
        const index = findIndexById(images, img.id);
        if (index >= 0) images.splice(index, 1);
        invalidatePendingImageLoad(img.id);
        if (socketConnected) socket.emit("item:remove", { boardId, type: "image", id: img.id });
        return;
      }
      const mapped = mapRectBetweenRects(getImageBoundsWorld(img), sourceRect, targetRect);
      img.x = mapped.x;
      img.y = mapped.y;
      img.width = mapped.width;
      img.height = mapped.height;
      img.user = publishOwner;
      img.layer = "user";
      img.draftBoardId = null;
      emitItemPatch("image", img, {
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        user: img.user,
        layer: "user",
        draftBoardId: null,
      });
    });

    const boardIndex = findIndexById(images, draftBoardId);
    if (boardIndex >= 0) {
      images.splice(boardIndex, 1);
      if (socketConnected) socket.emit("item:remove", { boardId, type: "image", id: draftBoardId });
    }
    refreshTextList();
    refreshImageList();
    selected = null;
    multiSelection = null;
    showTransientFooterMessage(
      onlyNew ? "下書きボード固有のオブジェクトをリンク元に公開しました。" : "下書きボードをここに公開しました。",
      3000
    );
    redraw();
  }

  function inferDraftBoardOriginalIds(board) {
    const ids = new Set(board?.draftBoardSource?.originalObjectIds || []);
    const source = board?.draftBoardSource;
    if (!board || !source?.width || !source?.height) return ids;
    const sourceRect = { x: source.x, y: source.y, width: source.width, height: source.height };
    const contentDest = {
      x: board.x,
      y: board.y + (source.headerHeight || 0),
      width: board.width,
      height: Math.max(1, board.height - (source.headerHeight || 0)),
    };
    const near = (a, b, tolerance = 1) => Math.abs((a || 0) - (b || 0)) <= tolerance;

    draftStrokes.filter((item) => item?.draftBoardId === board.id).forEach((draft) => {
      const copied = strokes.some((original) => {
        if (!original || !!original.fill !== !!draft.fill || original.color !== draft.color) return false;
        if ((original.points || []).length !== (draft.points || []).length) return false;
        return (original.points || []).every((point, index) => {
          const mapped = mapRectPointBetweenRects(point, sourceRect, contentDest);
          return near(mapped.x, draft.points[index]?.x) && near(mapped.y, draft.points[index]?.y);
        });
      });
      if (copied) ids.add(draft.id);
    });

    texts.filter((item) => item?.draftBoardId === board.id).forEach((draft) => {
      const copied = texts.some((original) => {
        if (!original || original.draftBoardId) return false;
        if ((original.lines || []).join("\n") !== (draft.lines || []).join("\n")) return false;
        const mapped = mapRectPointBetweenRects({ x: original.x, y: original.y }, sourceRect, contentDest);
        return near(mapped.x, draft.x) && near(mapped.y, draft.y);
      });
      if (copied) ids.add(draft.id);
    });

    images.filter((item) => item?.draftBoardId === board.id).forEach((draft) => {
      const copied = images.some((original) => {
        if (!original || original.draftBoardId || original.id === board.id || original.src !== draft.src) return false;
        const mapped = mapRectBetweenRects(getImageBoundsWorld(original), sourceRect, contentDest);
        return near(mapped.x, draft.x) && near(mapped.y, draft.y) && near(mapped.width, draft.width) && near(mapped.height, draft.height);
      });
      if (copied) ids.add(draft.id);
    });
    return ids;
  }

  function deleteDraftBoard(imgObj) {
    if (!imgObj || !isDraftBoardImage(imgObj) || imgObj.user !== currentUser) return;
    ensureSnapshotForAction();
    const draftBoardId = imgObj.id;

    for (let i = draftStrokes.length - 1; i >= 0; i--) {
      const draft = draftStrokes[i];
      if (!draft || draft.draftBoardId !== draftBoardId || draft.user !== currentUser) continue;
      draftStrokes.splice(i, 1);
      if (socketConnected) socket.emit("draft:stroke:remove", { boardId, id: draft.id });
    }

    for (let i = texts.length - 1; i >= 0; i--) {
      const text = texts[i];
      if (!text || text.draftBoardId !== draftBoardId || text.user !== currentUser) continue;
      texts.splice(i, 1);
      if (socketConnected) socket.emit("item:remove", { boardId, type: "text", id: text.id });
    }

    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (!img || img.id === draftBoardId || img.draftBoardId !== draftBoardId || img.user !== currentUser) continue;
      images.splice(i, 1);
      invalidatePendingImageLoad(img.id);
      if (socketConnected) socket.emit("item:remove", { boardId, type: "image", id: img.id });
    }

    const boardIndex = findIndexById(images, draftBoardId);
    if (boardIndex >= 0) {
      images.splice(boardIndex, 1);
      invalidatePendingImageLoad(draftBoardId);
      if (socketConnected) socket.emit("item:remove", { boardId, type: "image", id: draftBoardId });
    }

    refreshTextList();
    refreshImageList();
    selected = null;
    multiSelection = null;
    showTransientFooterMessage("下書きボードを削除しました。", 3000);
    redraw();
  }

  function createHighQualityLassoScreenshot(cleaned) {
    const originalCanvasWidth = canvas.width;
    const originalCanvasHeight = canvas.height;
    const originalScale = scale;
    const originalOffsetX = offsetX;
    const originalOffsetY = offsetY;
    const originalSelected = selected;
    const originalMultiSelection = multiSelection;
    const minScale = 2;
    const maxScale = 4;
    const maxPixels = 16000000;
    const deviceScale = window.devicePixelRatio || 1;
    const captureScaleBase = Math.max(originalScale * deviceScale, minScale);
    const padWorld = 2 / Math.max(originalScale, 0.001);
    const worldPoints = cleaned.map((p) => screenToWorld(p.x, p.y));
    const worldBounds = getPathBoundsScreen(worldPoints);
    const captureBounds = {
      x: worldBounds.x - padWorld,
      y: worldBounds.y - padWorld,
      width: worldBounds.width + padWorld * 2,
      height: worldBounds.height + padWorld * 2,
    };

    let captureScale = Math.min(captureScaleBase, maxScale);
    let outW = Math.max(1, Math.ceil(captureBounds.width * captureScale));
    let outH = Math.max(1, Math.ceil(captureBounds.height * captureScale));
    const pixels = outW * outH;
    if (pixels > maxPixels) {
      const shrink = Math.sqrt(maxPixels / pixels);
      captureScale = Math.max(0.25, captureScale * shrink);
      outW = Math.max(1, Math.ceil(captureBounds.width * captureScale));
      outH = Math.max(1, Math.ceil(captureBounds.height * captureScale));
    }

    const clipCanvas = document.createElement("canvas");
    clipCanvas.width = outW;
    clipCanvas.height = outH;
    const clipCtx = clipCanvas.getContext("2d");
    if (!clipCtx) throw new Error("failed to create lasso clip context");

    try {
      selected = null;
      multiSelection = null;
      scale = captureScale;
      offsetX = -captureBounds.x * captureScale;
      offsetY = -captureBounds.y * captureScale;
      canvas.width = outW;
      canvas.height = outH;
      renderNow();

      clipCtx.save();
      clipCtx.beginPath();
      clipCtx.moveTo(
        (worldPoints[0].x - captureBounds.x) * captureScale,
        (worldPoints[0].y - captureBounds.y) * captureScale
      );
      for (let i = 1; i < worldPoints.length; i++) {
        clipCtx.lineTo(
          (worldPoints[i].x - captureBounds.x) * captureScale,
          (worldPoints[i].y - captureBounds.y) * captureScale
        );
      }
      clipCtx.closePath();
      clipCtx.clip();
      clipCtx.drawImage(canvas, 0, 0);
      clipCtx.restore();
      return {
        src: clipCanvas.toDataURL("image/png"),
        worldBounds: captureBounds,
      };
    } finally {
      canvas.width = originalCanvasWidth;
      canvas.height = originalCanvasHeight;
      scale = originalScale;
      offsetX = originalOffsetX;
      offsetY = originalOffsetY;
      selected = originalSelected;
      multiSelection = originalMultiSelection;
      renderNow();
    }
  }

  function createImageFromLassoPath(path, mode = lassoCopyMode, options = {}) {
    const cleaned = (path || []).filter((p) => p && typeof p.x === "number" && typeof p.y === "number");
    if (cleaned.length < 3) {
      redraw();
      return;
    }

    const bounds = getPathBoundsScreen(cleaned);
    if (!bounds || bounds.width < 4 || bounds.height < 4) {
      updateToolButtons();
      redraw();
      return;
    }

    ensureSnapshotForAction();

    const previousSelected = selected;
    const previousMultiSelection = multiSelection;
    selected = null;
    multiSelection = null;
    renderNow();

    let src = "";
    let captureWorldBounds = null;
    let lassoOutlinePath = Array.isArray(options.lassoOutlinePath) ? options.lassoOutlinePath : null;
    try {
      const capture = createHighQualityLassoScreenshot(cleaned);
      src = capture.src;
      captureWorldBounds = capture.worldBounds;
      if (!lassoOutlinePath && mode !== "rect" && captureWorldBounds?.width > 0 && captureWorldBounds?.height > 0) {
        lassoOutlinePath = cleaned.map((point) => {
          const worldPoint = screenToWorld(point.x, point.y);
          return {
            x: (worldPoint.x - captureWorldBounds.x) / captureWorldBounds.width,
            y: (worldPoint.y - captureWorldBounds.y) / captureWorldBounds.height,
          };
        });
      }
    } catch (err) {
      console.warn("failed to create lasso screenshot", err);
      selected = previousSelected;
      multiSelection = previousMultiSelection;
      updateToolButtons();
      showTransientFooterMessage("この範囲は画像化できませんでした。外部画像が含まれている可能性があります。", 6000);
      redraw();
      return;
    }
    const img = new Image();
    img.onload = () => {
      const topLeft = captureWorldBounds || screenToWorld(bounds.x, bounds.y);
      const offsetWorld = 18 / Math.max(scale, 0.001);
      const imgObj = {
        id: genId(),
        img,
        src,
        x: topLeft.x + offsetWorld,
        y: topLeft.y + offsetWorld,
        width: (captureWorldBounds?.width || bounds.width / Math.max(scale, 0.001)),
        height: (captureWorldBounds?.height || bounds.height / Math.max(scale, 0.001)),
        layer: getImageTargetLayer(),
        order: orderCounter++,
        user: currentUser,
        rotation: 0,
        imageName: "投げ縄スクショ",
        imageListOrder: bumpImageListOrderCounter(),
        lassoToolObject: true,
        lassoOutlinePath,
      };
      applyFrameMembershipByPoint(imgObj, {
        x: imgObj.x + imgObj.width / 2,
        y: imgObj.y + imgObj.height / 2,
      });
      images.push(imgObj);
      registerUser(currentUser);
      refreshImageList();
      emitImageAdd(imgObj);
      selected = { type: "image", index: images.length - 1 };
      multiSelection = null;
      updateToolButtons();
      updateFooterByState();
      redraw();
    };
    img.onerror = () => {
      selected = previousSelected;
      multiSelection = previousMultiSelection;
      updateToolButtons();
      redraw();
    };
    img.src = src;
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

  function stopWritingLabelCleanup() {
    if (writingLabelCleanupTimer) {
      clearInterval(writingLabelCleanupTimer);
      writingLabelCleanupTimer = null;
    }
  }

  function cleanupExpiredWritingLabels() {
    const now = Date.now();
    let changed = false;
    for (const [user, label] of Array.from(writingLabels.entries())) {
      if (now - label.updatedAt > WRITING_LABEL_TIMEOUT_MS) {
        writingLabels.delete(user);
        changed = true;
      }
    }
    if (writingLabels.size === 0) stopWritingLabelCleanup();
    if (changed) redraw();
  }

  function ensureWritingLabelCleanup() {
    if (writingLabels.size === 0 || writingLabelCleanupTimer) return;
    writingLabelCleanupTimer = setInterval(cleanupExpiredWritingLabels, 1000);
  }

  function startLocalWritingLabel(worldPos) {
    if (!currentUser || !worldPos || activeLayer === "draft") return;
    localWritingActive = true;
    lastWritingLabelEmitAt = Date.now();
    if (socketConnected) {
      socket.emit("presence:writing:start", {
        boardId,
        data: { user: currentUser, x: worldPos.x, y: worldPos.y },
      });
    }
  }

  function updateLocalWritingLabel(worldPos) {
    if (!localWritingActive || !currentUser || !worldPos || activeLayer === "draft") return;
    const now = Date.now();
    if (now - lastWritingLabelEmitAt < 100) return;
    lastWritingLabelEmitAt = now;
    if (socketConnected) {
      socket.emit("presence:writing:update", {
        boardId,
        data: { user: currentUser, x: worldPos.x, y: worldPos.y },
      });
    }
  }

  function endLocalWritingLabel() {
    if (!localWritingActive) return;
    localWritingActive = false;
    lastWritingLabelEmitAt = 0;
    if (socketConnected) {
      socket.emit("presence:writing:end", { boardId, user: currentUser });
    }
  }

  function drawWritingLabels() {
    cleanupExpiredWritingLabels();
    if (writingLabels.size === 0) return;

    ctx.save();
    ctx.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    const paddingX = 10;
    const radius = 8;
    const tailW = 10;
    const tailH = 8;
    const margin = 8;
    const maxY = Math.max(0, canvas.height - getFooterSpace());
    const fitLabel = (value, maxWidth) => {
      if (ctx.measureText(value).width <= maxWidth) return value;
      let base = value;
      while (base.length > 1) {
        base = base.slice(0, -1);
        const result = `${base}...`;
        if (ctx.measureText(result).width <= maxWidth) return result;
      }
      return value.slice(0, 1);
    };

    writingLabels.forEach((label) => {
      const user = label.user;
      if (!user) return;
      const screen = worldToScreen(label.x, label.y);
      const maxTextW = Math.max(24, Math.min(180, canvas.width - margin * 2 - paddingX * 2));
      const text = fitLabel(String(user), maxTextW);
      const textWidth = ctx.measureText(text).width;
      const bubbleW = Math.max(36, textWidth + paddingX * 2);
      const bubbleH = 28;
      let x = screen.x - bubbleW / 2;
      let y = screen.y - bubbleH - tailH;
      const maxX = Math.max(margin, canvas.width - bubbleW - margin);
      const maxBubbleY = Math.max(margin, maxY - bubbleH - tailH - margin);

      x = Math.min(Math.max(margin, x), maxX);
      y = Math.min(Math.max(margin, y), maxBubbleY);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + bubbleW - radius, y);
      ctx.quadraticCurveTo(x + bubbleW, y, x + bubbleW, y + radius);
      ctx.lineTo(x + bubbleW, y + bubbleH - radius);
      ctx.quadraticCurveTo(x + bubbleW, y + bubbleH, x + bubbleW - radius, y + bubbleH);
      const tailX = Math.min(Math.max(screen.x, x + radius + tailW), x + bubbleW - radius - tailW);
      ctx.lineTo(tailX + tailW / 2, y + bubbleH);
      ctx.lineTo(screen.x, screen.y);
      ctx.lineTo(tailX - tailW / 2, y + bubbleH);
      ctx.lineTo(x + radius, y + bubbleH);
      ctx.quadraticCurveTo(x, y + bubbleH, x, y + bubbleH - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(text, x + paddingX, y + bubbleH / 2);
    });

    ctx.restore();
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

  function findAttentionPointerAt(screenX, screenY) {
    const footerSpace = getFooterSpace();
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height - footerSpace;

    // 後から描画されたポインターを優先する
    const pointers = Array.from(attentionPointers.values()).reverse();
    for (const p of pointers) {
      const screen = worldToScreen(p.x, p.y);
      const visible =
        screen.x >= 0 && screen.x <= w && screen.y >= 0 && screen.y <= h;

      if (visible) {
        if (Math.hypot(screenX - screen.x, screenY - screen.y) <= 22) return p;
        continue;
      }

      // 矢印は脈動するため、最大描画サイズを含む少し広めの範囲で判定する
      const padding = 12;
      let arrowX = Math.min(Math.max(screen.x, padding), w - padding);
      let arrowY = Math.min(Math.max(screen.y, padding), h - padding - footerSpace);
      if (screen.x < 0) arrowX = padding;
      if (screen.x > w) arrowX = w - padding;
      if (screen.y < 0) arrowY = padding;
      if (screen.y > h) arrowY = h - padding - footerSpace;

      if (Math.hypot(screenX - arrowX, screenY - arrowY) <= 68) return p;
    }
    return null;
  }

  function focusAttentionPointerAt(screenX, screenY) {
    const pointer = findAttentionPointerAt(screenX, screenY);
    if (!pointer) return false;
    offsetX = canvas.width / 2 - pointer.x * scale;
    offsetY = canvas.height / 2 - pointer.y * scale;
    redraw();
    return true;
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
  const IMAGE_INSERT_MAX_WIDTH = 900;
  const IMAGE_INSERT_MAX_HEIGHT = 650;
  const IMAGE_INSERT_GAP_X = 6;
  const IMAGE_INSERT_GAP_Y = 16;

  function getInsertedImageWorldSize(img) {
    let w = img.width;
    let h = img.height;
    const r = Math.min(1, IMAGE_INSERT_MAX_WIDTH / w, IMAGE_INSERT_MAX_HEIGHT / h);
    return { width: w * r, height: h * r };
  }

  function getImageTargetLayer() {
    if (!isAdminUser()) return "user";
    if (activeLayer === "image") return "image";
    if (activeLayer === "base") return "base";
    if (activeLayer === "admin") return "admin";
    return "user";
  }

  async function addImageFile(file, worldX, worldY, layout = null, targetLayer = getImageTargetLayer()) {
    if (!canCreateOnCurrentLayer()) return;
    try {
      const { img, src } = await loadImageFromFile(file);
      const { width: w, height: h } = getInsertedImageWorldSize(img);

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
        src,
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
      applyFrameMembershipByPoint(imgObj, { x: placeX + w / 2, y: placeY + h / 2 });
      images.push(imgObj);
      registerUser(currentUser);
      refreshImageList();
      emitImageAdd(imgObj);

      selected = { type: "image", index: images.length - 1 };
      multiSelection = null;
      resetShapeMode();
      switchToSelectTool();
      updateFooterByState();
      redraw();
    } catch (err) {
      console.error("failed to load image", err);
    }
  }

  async function addImageFilesAt(files, worldX, worldY, targetLayer = getImageTargetLayer()) {
    if (!canCreateOnCurrentLayer()) return;
    const imageFiles = Array.from(files || []).filter((file) => file.type && file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const gapX = IMAGE_INSERT_GAP_X;
    const gapY = IMAGE_INSERT_GAP_Y;
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
        const { width: w, height: h } = getInsertedImageWorldSize(img);

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
        applyFrameMembershipByPoint(imgObj, { x: layout.currentX + w / 2, y: layout.y });
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

    multiSelection = null;
    if (layout.count > 0) {
      resetShapeMode();
      switchToSelectTool();
    }
    updateFooterByState();
    redraw();
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const src = resizeImageForStorage(img, reader.result, file.type);
          if (src === reader.result) {
            resolve({ img, src });
            return;
          }
          const resizedImg = new Image();
          resizedImg.onload = () => resolve({ img: resizedImg, src });
          resizedImg.onerror = reject;
          resizedImg.src = src;
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeImageForStorage(img, src, mimeType = "") {
    const maxSide = 1600;
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height || Math.max(width, height) <= maxSide) return src;

    const ratio = maxSide / Math.max(width, height);
    const canvasEl = document.createElement("canvas");
    canvasEl.width = Math.round(width * ratio);
    canvasEl.height = Math.round(height * ratio);
    const canvasCtx = canvasEl.getContext("2d");
    canvasCtx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
    const outputType = mimeType === "image/png" ? "image/png" : "image/jpeg";
    const resizedSrc = canvasEl.toDataURL(outputType, 0.82);
    if (outputType === "image/png" && resizedSrc.length > 12 * 1024 * 1024) {
      return canvasEl.toDataURL("image/jpeg", 0.82);
    }
    return resizedSrc;
  }

  function addTemplateImage(src, worldX, worldY, targetLayer = getImageTargetLayer(), imageName = "") {
    if (!src) return;
    if (!canCreateOnCurrentLayer()) return;
    const img = new Image();
    img.onload = () => {
      const { width: w, height: h } = getInsertedImageWorldSize(img);

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
      applyFrameMembershipByPoint(imgObj, { x: worldX, y: worldY });
      images.push(imgObj);
      registerUser(currentUser);
      refreshImageList();
      emitImageAdd(imgObj);

      selected = { type: "image", index: images.length - 1 };
      multiSelection = null;
      updateFooterByState();
      redraw();
    };
    img.src = src;
  }

  function insertSideTag(type) {
    if (!canCreateOnCurrentLayer()) return;
    ensureSnapshotForAction();
    const dataUrl = createSideTag(type);
    if (!dataUrl) return;
    const center = getCanvasCenterWorld();
    const img = new Image();
    img.onload = () => {
      const w = img.width / scale;
      const h = img.height / scale;
      // 既存の背景レイヤー内で最小の order よりさらに小さい値を付与して最背面に
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
      selected = { type: "image", index: images.length - 1 };
      multiSelection = null;
      updateFooterByState();
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
    registerDraftBoardNewObject(imgObj);
    const image = imageSnapshotPayload(imgObj);
    if (image?.id) pendingImageAdds.set(image.id, image);
    if (!socketConnected || !socketReady) {
      showTransientFooterMessage("接続が不安定です。再接続後に保存します。", 4000);
      return;
    }
    socket.timeout(5000).emit("image:add", { boardId, image }, (err, res) => {
      if (err || !res?.ok) {
        showTransientFooterMessage("画像の保存確認が取れません。再接続後に再送します。", 6000);
        return;
      }
      if (res.image) applyStoredImagePatch(image.id, res.image);
      pendingImageAdds.delete(image.id);
    });
  }

  function emitStrokeAdd(stroke) {
    if (!stroke?.id) return;
    pendingStrokeAdds.set(stroke.id, stableSnapshotValue(stroke));
    if (!socketConnected || !socketReady) {
      showTransientFooterMessage("接続が不安定です。再接続後に保存します。", 4000);
      return;
    }
    socket.timeout(5000).emit("stroke:add", { boardId, stroke }, (err, res) => {
      if (err || !res?.ok) {
        showTransientFooterMessage("線の保存確認が取れません。再接続後に再送します。", 6000);
        return;
      }
      pendingStrokeAdds.delete(stroke.id);
    });
  }

  function emitTextAdd(text) {
    registerDraftBoardNewObject(text);
    if (!text?.id) return;
    pendingTextAdds.set(text.id, stableSnapshotValue(text));
    if (!socketConnected || !socketReady) {
      showTransientFooterMessage("接続が不安定です。再接続後に保存します。", 4000);
      return;
    }
    socket.timeout(5000).emit("text:add", { boardId, text }, (err, res) => {
      if (err || !res?.ok) {
        showTransientFooterMessage("テキストの保存確認が取れません。再接続後に再送します。", 6000);
        return;
      }
      pendingTextAdds.delete(text.id);
    });
  }

  function registerDraftBoardNewObject(item) {
    if (!draftBoardViewId || !item?.id || item.draftBoardId !== draftBoardViewId) return;
    const board = images.find((img) => img?.id === draftBoardViewId && img.draftBoardSource);
    if (!board) return;
    const ids = Array.isArray(board.draftBoardSource.newObjectIds)
      ? board.draftBoardSource.newObjectIds
      : [];
    if (ids.includes(item.id)) return;
    board.draftBoardSource = { ...board.draftBoardSource, newObjectIds: [...ids, item.id] };
    emitItemPatch("image", board, { draftBoardSource: board.draftBoardSource });
  }

  function emitLinkAdd(link) {
    if (!link?.id) return;
    pendingLinkAdds.set(link.id, stableSnapshotValue(link));
    if (!socketConnected || !socketReady) {
      showTransientFooterMessage("接続が不安定です。再接続後に保存します。", 4000);
      return;
    }
    socket.timeout(5000).emit("link:add", { boardId, link }, (err, res) => {
      if (err || !res?.ok) {
        showTransientFooterMessage("リンクの保存確認が取れません。再接続後に再送します。", 6000);
        return;
      }
      pendingLinkAdds.delete(link.id);
    });
  }

  function restorePendingAdds() {
    pendingStrokeAdds.forEach((stroke) => {
      if (!stroke?.id || findIndexById(strokes, stroke.id) >= 0) return;
      addStrokeFromNetwork(stroke, false);
    });
    pendingTextAdds.forEach((text) => {
      if (!text?.id || findIndexById(texts, text.id) >= 0) return;
      addTextFromNetwork(text, false);
    });
    pendingImageAdds.forEach((image) => {
      if (!image?.id || findIndexById(images, image.id) >= 0) return;
      addImageFromNetwork(image, false, { redrawOnLoad: true });
    });
    pendingLinkAdds.forEach((link) => {
      if (!link?.id || findIndexById(links, link.id) >= 0) return;
      addLinkFromNetwork(link, false);
    });
  }

  function flushPendingAdds() {
    if (!socketConnected || !socketReady) return;
    pendingStrokeAdds.forEach((stroke) => {
      emitStrokeAdd(stroke);
    });
    pendingTextAdds.forEach((text) => {
      emitTextAdd(text);
    });
    pendingImageAdds.forEach((image) => {
      emitImageAdd(image);
    });
    pendingLinkAdds.forEach((link) => {
      emitLinkAdd(link);
    });
  }

  // --- テキスト入力 ---
  function getTextLayerForCurrentLayer() {
    return activeLayer === "base"
      ? "base"
      : activeLayer === "admin"
      ? "admin"
      : activeLayer === "draft"
      ? "draft"
      : "user";
  }

  function addTextObject(textData) {
    if (typeof textData.textListOrder !== "number") {
      textData.textListOrder = bumpTextListOrderCounter();
    } else {
      bumpTextListOrderCounter(textData.textListOrder);
    }
    texts.push(textData);
    registerUser(currentUser);
    emitTextAdd(textData);
  }

  function autosizeTextEditor(textarea) {
    if (!textarea) return;
    const minWidth = 220;
    const maxWidth = Math.max(minWidth, Math.min(720, window.innerWidth - 40));
    const minHeight = 44;
    const maxHeight = Math.max(minHeight, Math.min(520, window.innerHeight - 80));
    textarea.style.width = `${minWidth}px`;
    textarea.style.height = `${minHeight}px`;
    const nextWidth = Math.min(maxWidth, Math.max(minWidth, textarea.scrollWidth + 4));
    textarea.style.width = `${nextWidth}px`;
    textarea.style.height = `${Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight + 4))}px`;
  }

  function insertTextEditorNewline(textarea) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`;
    const next = start + 1;
    textarea.setSelectionRange(next, next);
    autosizeTextEditor(textarea);
  }

  function handleTextEditorKeydown(e, textarea, finish) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.shiftKey || e.altKey) {
      insertTextEditorNewline(textarea);
      return;
    }
    finish();
  }

  function buildGridTextObjects(lines, worldPos, fontSizeWorld, baseText) {
    const created = [];
    let row = 0;
    lines.forEach((line) => {
      if (line.length === 0) {
        row += 1;
        return;
      }
      created.push({
        ...baseText,
        id: genId(),
        lines: [line],
        x: worldPos.x,
        y: worldPos.y + row * fontSizeWorld,
        order: orderCounter++,
        createdAt: Date.now(),
        gridText: true,
      });
      row += 1;
    });
    return created;
  }

  function createTextEditorAt(screenX, screenY, initialValue = "", mode = "normal", options = {}) {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    if (activeLayer === "image") return;
    pendingTextPos = null;
    updateToolButtons();
    const initialWorldPos = options.mapWorld
      ? options.mapWorld(screenToWorld(screenX, screenY))
      : screenToWorld(screenX, screenY);
    const targetDraftBoard = options.draftBoard || getDraftBoardAtWorldPoint(initialWorldPos);
    const presetTags = collectTextTagsAtWorldPoint(initialWorldPos);

    if (textEditor) {
      endLocalWritingLabel();
      textEditor.remove();
      textEditor = null;
    }

    const startWorldPos = initialWorldPos;
    const textarea = document.createElement("textarea");
    textarea.className = "text-editor-overlay";

    const fontSizeWorld = textDefaultFontSizeWorld || 16;
    const fontSizePx = fontSizeWorld * scale;
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
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
    autosizeTextEditor(textarea);
    startLocalWritingLabel(startWorldPos);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (textEditor !== textarea) {
        endLocalWritingLabel();
        return;
      }
      const value = textarea.value;
      const rect = textarea.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const sx = rect.left - containerRect.left;
      const sy = rect.top - containerRect.top;
      const rawWorldPos = screenToWorld(sx, sy);
      const worldPos = options.mapWorld ? options.mapWorld(rawWorldPos) : rawWorldPos;

      textarea.remove();
      textEditor = null;
      endLocalWritingLabel();
      switchToSelectTool();

      if (value.trim()) {
        ensureSnapshotForAction();
        const lines = value.split(/\r?\n/);
        const created = [];
        if (mode === "grid") {
          const membership = getFrameMembershipAtWorldPoint(worldPos);
          created.push(
            ...buildGridTextObjects(lines, worldPos, fontSizeWorld, {
              fontSize: fontSizeWorld,
              color: textDefaultColor,
              user: currentUser,
              layer: targetDraftBoard ? "draft" : getTextLayerForCurrentLayer(),
              label: serializeTextTags(presetTags),
              rotation: 0,
              vertical: false,
              frameId: membership?.frameId || null,
              frameTab: membership?.frameTab || null,
              draftBoardId: targetDraftBoard?.img?.id || null,
            })
          );
        } else {
          const t = {
            id: genId(),
            lines,
            x: worldPos.x,
            y: worldPos.y,
            fontSize: fontSizeWorld,
            color: textDefaultColor,
            user: currentUser,
            layer: targetDraftBoard ? "draft" : getTextLayerForCurrentLayer(),
            order: orderCounter++,
            createdAt: Date.now(),
            label: serializeTextTags(presetTags),
            rotation: 0,
            vertical: false,
            gridText: false,
            draftBoardId: targetDraftBoard?.img?.id || null,
          };
          if (!targetDraftBoard) applyFrameMembershipByPoint(t, worldPos);
          created.push(t);
        }
        created.forEach(addTextObject);
        if (!created.length) {
          updateFooterByState();
          redraw();
          return;
        }

        refreshTextList();

        // このテキストの色とサイズをデフォルトとして記憶
        textDefaultColor = created[created.length - 1].color;
        textDefaultFontSizeWorld = created[created.length - 1].fontSize;

        selected = { type: "text", index: texts.length - 1 };
        multiSelection = null;
        updateFooterByState();
        redraw();
      }
    };

    textarea.addEventListener("blur", finish);
    textarea.addEventListener("input", () => autosizeTextEditor(textarea));
    textarea.addEventListener("keydown", (e) => {
      handleTextEditorKeydown(e, textarea, finish);
    });
  }

  function editTextAt(index) {
    const t = texts[index];
    if (!t) return;
    if (!canInteractText(t)) return;
    if (textEditor) {
      endLocalWritingLabel();
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
    textarea.style.fontSize = `${fontSizePx}px`;
    const baseColor = normalizeHexColor(t.color || "#000000");
    textarea.style.color = lightenColor(baseColor);
    textarea.style.textShadow = buildTextShadow(baseColor, fontSizePx);
    textarea.value = t.lines.join("\n");
    const originalValue = textarea.value;
    container.appendChild(textarea);
    textarea.focus();
    textEditor = textarea;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autosizeTextEditor(textarea);
    startLocalWritingLabel({ x: t.x, y: t.y });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (textEditor !== textarea) {
        endLocalWritingLabel();
        return;
      }
      const value = textarea.value;
      textarea.remove();
      textEditor = null;
      endLocalWritingLabel();
      switchToSelectTool();
      const trimmed = value.trim();
      if (value === originalValue) {
        updateFooterByState();
        redraw();
        return;
      }
      ensureSnapshotForAction();
      if (!trimmed) {
        // 空なら削除
        const removed = texts.splice(index, 1)[0];
        refreshTextList();
        selected = null;
        multiSelection = null;
        updateFooterByState();
        redraw();
        if (removed && socketConnected) {
          socket.emit("item:remove", { boardId, type: "text", id: removed.id });
        }
        return;
      }
      const lines = value.split(/\r?\n/);
      if (t.gridText && lines.length > 1) {
        const firstLine = lines[0] ?? "";
        texts[index] = {
          ...t,
          lines: [firstLine],
          layer: t.layer,
        };
        const created = buildGridTextObjects(lines.slice(1), { x: t.x, y: t.y + (t.fontSize || 16) }, t.fontSize || 16, t);
        created.forEach(addTextObject);
        selected = { type: "text", index };
        multiSelection = null;
        refreshTextList();
        updateFooterByState();
        redraw();
        if (socketConnected) {
          socket.emit("item:update", {
            boardId,
            type: "text",
            id: t.id,
            patch: { lines: [firstLine] },
          });
        }
        return;
      }
      texts[index] = {
        ...t,
        lines,
        layer: t.layer,
      };
      selected = { type: "text", index };
      multiSelection = null;
      refreshTextList();
      updateFooterByState();
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
    textarea.addEventListener("input", () => autosizeTextEditor(textarea));
    textarea.addEventListener("keydown", (e) => {
      handleTextEditorKeydown(e, textarea, finish);
    });
  }

  // --- クリップボードからのテキスト挿入 ---
  function extractSingleUrl(text) {
    const value = String(text || "").trim();
    const match = value.match(/^https?:\/\/\S+$/i);
    return match ? match[0] : "";
  }

  async function fetchLinkPreview(url) {
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("preview failed");
      return await res.json();
    } catch {
      const host = new URL(url).hostname;
      return { url, title: url, description: "", image: "", siteName: host };
    }
  }

  async function addLinkFromClipboard(url, worldX, worldY) {
    if (!canCreateOnCurrentLayer()) return;
    if (activeLayer !== "user" && activeLayer !== "admin" && activeLayer !== "base") return;
    const preview = await fetchLinkPreview(url);
    ensureSnapshotForAction();
    const link = {
      id: genId(),
      url: preview.url || url,
      title: preview.title || url,
      description: preview.description || "",
      image: preview.image || "",
      favicon: preview.favicon || "",
      siteName: preview.siteName || "",
      x: worldX,
      y: worldY,
      width: 340,
      height: 150,
      user: currentUser,
      layer: activeLayer === "base" ? "base" : "user",
      order: orderCounter++,
      createdAt: Date.now(),
    };
    links.push(link);
    registerUser(currentUser);
    emitLinkAdd(link);
    refreshLinkList();
    selected = { type: "link", index: links.length - 1 };
    multiSelection = null;
    updateFooterByState();
    redraw();
  }

  function addTextFromClipboard(text, worldX, worldY) {
    if (!canCreateOnCurrentLayer()) return;
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
      vertical: false,
      gridText: false,
      textListOrder: bumpTextListOrderCounter(),
    };
    applyFrameMembershipByPoint(t, { x: worldX, y: worldY });
    texts.push(t);
    registerUser(currentUser);
    emitTextAdd(t);
    refreshTextList();

    // このテキストをデフォルトとして記憶
    textDefaultColor = t.color;
    textDefaultFontSizeWorld = t.fontSize;

    selected = { type: "text", index: texts.length - 1 };
    multiSelection = null;
    updateFooterByState();
    redraw();
  }

  // --- ポインタ操作 ---

  function handleScreenShareBoardPreviewInput(e) {
    if (!screenShareFocus) return false;
    e.preventDefault();
    e.stopPropagation();
    screenShareFocus = false;
    updateScreenShareLayout();
    return true;
  }

  function handlePointerDown(e) {
    if (handleScreenShareBoardPreviewInput(e)) return;
    actionSnapshotTaken = false;
    closeMobileToolbarIfNeeded(e);
    if (e.touches && e.touches.length >= 2) {
      startPinchGesture(e);
      return;
    }

    const primaryButton = e.button == null || e.button === 0;
    if (primaryButton) {
      const canvasPos = getCanvasPointFromEvent(e);
      if (focusAttentionPointerAt(canvasPos.x, canvasPos.y)) {
        e.preventDefault();
        return;
      }
    }

    if (linkBoardMode && (e.button ?? 0) === 0) {
      if (!canCreateOnCurrentLayer()) return;
      e.preventDefault();
      const canvasPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      if (linkBoardMode === "source") {
        linkBoardSourceStart = worldPos;
        linkBoardSourcePreview = worldPos;
      } else if (linkBoardMode === "place" && pendingLinkBoardSource) {
        linkBoardPlaceStart = worldPos;
        linkBoardPlacePreview = worldPos;
      }
      redraw();
      return;
    }

    if (framePlaceType && e.button === 0) {
      if (!canCreateOnCurrentLayer()) return;
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
      if (!canCreateOnCurrentLayer()) return;
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
    const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
    const isRightButton = e.button === 2;
    const isMiddleButton = e.button === 1;

    if (
      lassoCopySelection &&
      e.button === 0 &&
      currentTool === "select" &&
      !hitTestLassoCopySelectionScreen(canvasPos)
    ) {
      clearLassoCopySelection();
      selected = null;
      multiSelection = null;
      updateFooterByState();
      redraw();
      return;
    }

    if (e.button === 0 && currentTool === "select") {
      const linkedLabelHit = hitTestLinkedBoardLabel(canvasPos.x, canvasPos.y);
      if (linkedLabelHit) {
        e.preventDefault();
        linkedBoardLabelDrag = {
          index: linkedLabelHit.index,
          id: linkedLabelHit.img.id,
          startScreen: { x: canvasPos.x, y: canvasPos.y },
          startWorld: { x: linkedLabelHit.img.x, y: linkedLabelHit.img.y },
          moved: false,
        };
        startImageDragAtCanvasPoint(linkedLabelHit.index, canvasPos, { snapshot: false });
        return;
      }
    }

    if (pendingTextListGridCopies && e.button === 0) {
      if (!canCreateOnCurrentLayer()) return;
      e.preventDefault();
      placePendingTextListGridCopies(worldPos);
      return;
    }

    if (currentTool === "lasso-copy" && (e.button ?? 0) === 0) {
      if (!requireUser()) return;
      if (!canCreateOnCurrentLayer()) return;
      e.preventDefault();
      const lassoObjectIndex = hitTestImage(canvasPos.x, canvasPos.y, {
        includeFrameBody: false,
        includeNonFrameImages: true,
      });
      if (lassoObjectIndex >= 0 && isLassoToolObject(images[lassoObjectIndex])) {
        startImageDragAtCanvasPoint(lassoObjectIndex, canvasPos);
        return;
      }
      selected = null;
      multiSelection = null;
      lassoCopySelection = null;
      lassoCopyActive = true;
      lassoCopyPath = [canvasPos];
      redraw();
      return;
    }

    if (e.button === 0 && currentTool === "select") {
      const tabHit = hitTestFrameTabControl(canvasPos.x, canvasPos.y);
      if (tabHit && tabHit.action !== "header") {
        e.preventDefault();
        if (tabHit.action === "add") {
          ensureSnapshotForAction();
          addFrameTab(tabHit.frame);
        } else if (tabHit.action === "background") {
          activateFrameTab(tabHit.frame, "background");
        } else if (tabHit.action === "tab") {
          activateFrameTab(tabHit.frame, tabHit.tabId);
        }
        selected = { type: "image", index: tabHit.index };
        multiSelection = null;
        return;
      }
    }

    if (pendingTextMode && e.button === 0) {
      if (!canCreateOnCurrentLayer()) return;
      e.preventDefault();
      const linked = getLinkedBoardAtWorldPoint(worldPos);
      const draftBoard = linked ? null : getDraftBoardAtWorldPoint(worldPos);
      createTextEditorAt(canvasPos.x, canvasPos.y, "", pendingTextMode, {
        mapWorld: linked ? (point) => mapLinkedBoardWorldToSource(linked.img, point) : null,
        draftBoard,
      });
      return;
    }

    pendingTextPos = null;

    if (e.button === 0 && e.altKey) {
      e.preventDefault();
      const wasSelected = selectAtPoint(canvasPos);
      if (wasSelected) {
        handleAltSelectionAction(activeAltSide === "right" ? "ccw" : "cw");
        return;
      }
    }

    if (e.button === 0 && e.detail >= 2) {
      const frameIndex = hitTestFrameLabel(canvasPos.x, canvasPos.y);
      if (frameIndex >= 0 && editFrameLabelAt(frameIndex)) {
        ignoreNextDblClick = true;
        return;
      }
      if (hitTestText(canvasPos.x, canvasPos.y) >= 0) {
        return;
      }
    }

    if (isMiddleButton) {
      isPanning = true;
      lastPan = { x: e.clientX, y: e.clientY };
      hideContextMenu();
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

    if (currentTool === "select" && e.button === 0 && e.ctrlKey) {
      e.preventDefault();
      toggleSelectionAtPoint(canvasPos);
      return;
    }

    const multiResizeHandle =
      currentTool === "select" && e.button === 0
        ? hitTestMultiSelectionResizeHandle(canvasPos.x, canvasPos.y)
        : null;
    if (multiResizeHandle) {
      const bounds = getSelectionWorldBounds(multiSelection.items);
      const anchor = getResizeAnchorForHandle(bounds, multiResizeHandle.handle);
      if (bounds && anchor) {
        ensureSnapshotForAction();
        selected = null;
        resizeInfo = {
          type: "multi",
          handle: multiResizeHandle.handle,
          anchorX: anchor.x,
          anchorY: anchor.y,
          startW: bounds.width,
          startH: bounds.height,
          startDistance: Math.hypot(worldPos.x - anchor.x, worldPos.y - anchor.y),
          items: captureMultiResizeItems(multiSelection.items),
        };
        isResizingObject = true;
        redraw();
        return;
      }
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
          } else if (it.type === "link") {
            const link = links[it.index];
            return { type: "link", index: it.index, x: link?.x, y: link?.y };
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
      if (!canCreateOnCurrentLayer()) return;
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
        activeLayer !== "base" &&
        activeLayer !== "draft" &&
        !(activeLayer === "image" && isAdminUser())
      )
        return;
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      selected = null;
      isErasing = true;
      const linked = getLinkedBoardAtWorldPoint(worldPos);
      const erasePoint = linked ? mapLinkedBoardWorldToSource(linked.img, worldPos) : worldPos;
      eraseAt(erasePoint.x, erasePoint.y);
      return;
    }

    // 選択ツールでないときは、ペン専用
    if (currentTool !== "select") {
      if (!requireUser()) return;
      if (!canCreateOnCurrentLayer()) return;
      ensureSnapshotForAction();
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const linked = getLinkedBoardAtWorldPoint(worldPos);
      const draftBoard = linked ? null : getDraftBoardAtWorldPoint(worldPos);
      const drawWorldPos = linked ? mapLinkedBoardWorldToSource(linked.img, worldPos) : worldPos;
      activeLinkedBoardId = linked?.img?.id || null;
      if (activeLayer === "draft" || draftBoard) {
        const baseColor = draftBoard ? currentColor : withAlpha(currentColor, 0.55);
        const stroke = {
          id: genId(),
          color: baseColor,
          size: currentSize,
          points: [drawWorldPos],
          user: currentUser,
          order: draftOrderCounter++,
          createdAt: Date.now(),
          draftBoardId: draftBoard?.img?.id || null,
        };
        applyCurrentGlowColor(stroke);
        if (!draftBoard) applyFrameMembershipByPoint(stroke, drawWorldPos);
        draftStrokes.push(stroke);
        registerDraftBoardNewObject(stroke);
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
          points: [drawWorldPos],
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
        applyCurrentGlowColor(stroke);
        applyFrameMembershipByPoint(stroke, drawWorldPos);
        strokes.push(stroke);
        registerUser(currentUser);
        activeStrokeId = stroke.id;
        isDrawing = true;
        isDrawingDraft = false;
      }
      startLocalWritingLabel(drawWorldPos);
      redraw();
      return;
    }

    // 以下、選択ツール時の処理
    // テキストのリサイズハンドル
    const textHandle = hitTestTextResizeHandle(canvasPos.x, canvasPos.y);
    if (textHandle) {
      ensureSnapshotForAction();
      selected = { type: "text", index: textHandle.index };
      const t = texts[textHandle.index];
      const b = getTextBoundsWorld(t);
      const anchor = getResizeAnchorForHandle(b, textHandle.handle);
      resizeInfo = {
        type: "text",
        index: textHandle.index,
        handle: textHandle.handle,
        originX: b.x,
        originY: b.y,
        anchorX: anchor.x,
        anchorY: anchor.y,
        startW: b.width,
        startH: b.height,
        startDistance: Math.hypot(worldPos.x - anchor.x, worldPos.y - anchor.y),
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
      if (
        imgObj &&
        !isFrameContainer(imgObj) &&
        !isOmoteUraTagImage(imgObj) &&
        !isBoardOverlayImage(imgObj) &&
        (normalizeRotation(imgObj.rotation || 0) || imgObj.mirrored)
      ) {
        const visualBounds = getRotatedImageVisualBoundsWorld(imgObj) || getImageBoundsWorld(imgObj);
        const normalizedPatch = normalizeImageAsFrameBackground(imgObj, visualBounds);
        if (Object.keys(normalizedPatch).length) emitItemPatch("image", imgObj, normalizedPatch);
      }
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
        handle: imgHandle.handle,
        anchorX: anchor.x,
        anchorY: anchor.y,
        startW: imgObj.width,
        startH: imgObj.height,
      };
      isResizingObject = true;
      redraw();
      return;
    }

    // リンクカード本体ヒット → ドラッグ移動
    const linkOpenIndex = hitTestLinkOpenButton(canvasPos.x, canvasPos.y);
    if (linkOpenIndex >= 0) {
      e.preventDefault();
      selected = { type: "link", index: linkOpenIndex };
      multiSelection = null;
      redraw();
      window.open(links[linkOpenIndex].url, "_blank", "noopener");
      return;
    }

    const topHit = hitTestTopSelectableRawItem(canvasPos);
    if (topHit?.type === "link") {
      ensureSnapshotForAction();
      selected = { type: "link", index: topHit.index };
      multiSelection = null;
      const link = links[topHit.index];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - link.x,
        y: worldPos.y - link.y,
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    if (topHit?.type === "text") {
      ensureSnapshotForAction();
      selected = { type: "text", index: topHit.index };
      multiSelection = null;
      const t = texts[topHit.index];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - t.x,
        y: worldPos.y - t.y,
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    if (topHit?.type === "image") {
      startImageDragAtCanvasPoint(topHit.index, canvasPos);
      return;
    }

    if (topHit?.type === "stroke") {
      ensureSnapshotForAction();
      selected = getStrokeGroupSelection(topHit.index);
      multiSelection = null;
      const s = strokes[topHit.index];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - (s.points[0]?.x || worldPos.x),
        y: worldPos.y - (s.points[0]?.y || worldPos.y),
      };
      isDraggingObject = true;
      redraw();
      return;
    }

    if (topHit?.type === "draft") {
      ensureSnapshotForAction();
      selected = getDraftGroupSelection(topHit.index);
      multiSelection = null;
      const s =
        selected?.type === "draft-group"
          ? draftStrokes[selected.indices[0]]
          : draftStrokes[topHit.index];
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      dragOffsetWorld = {
        x: worldPos.x - (s.points[0]?.x || worldPos.x),
        y: worldPos.y - (s.points[0]?.y || worldPos.y),
      };
      isDraggingObject = true;
      redraw();
      return;
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
    if (screenShareFocus) {
      e.preventDefault();
      return;
    }
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
    updateFrameTabTooltip(canvasPos, e.clientX, e.clientY);
    if (linkedBoardLabelDrag) {
      const dx = canvasPos.x - linkedBoardLabelDrag.startScreen.x;
      const dy = canvasPos.y - linkedBoardLabelDrag.startScreen.y;
      if (!linkedBoardLabelDrag.moved && Math.hypot(dx, dy) > 4) {
        const imgObj =
          images[linkedBoardLabelDrag.index]?.id === linkedBoardLabelDrag.id
            ? images[linkedBoardLabelDrag.index]
            : images.find((img) => img?.id === linkedBoardLabelDrag.id);
        if (imgObj) {
          imgObj.x = linkedBoardLabelDrag.startWorld.x;
          imgObj.y = linkedBoardLabelDrag.startWorld.y;
        }
        ensureSnapshotForAction();
        linkedBoardLabelDrag.moved = true;
      }
    }

    if (linkBoardMode === "source" && linkBoardSourceStart) {
      linkBoardSourcePreview = screenToWorld(canvasPos.x, canvasPos.y);
      redraw();
      e.preventDefault();
      return;
    }

    if (linkBoardMode === "place" && linkBoardPlaceStart) {
      linkBoardPlacePreview = screenToWorld(canvasPos.x, canvasPos.y);
      redraw();
      e.preventDefault();
      return;
    }

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

    if (lassoCopyActive) {
      if (lassoCopyMode === "rect") {
        lassoCopyPath[1] = canvasPos;
        redraw();
      } else {
        const last = lassoCopyPath[lassoCopyPath.length - 1];
        if (!last || Math.hypot(canvasPos.x - last.x, canvasPos.y - last.y) >= 2) {
          lassoCopyPath.push(canvasPos);
          redraw();
        }
      }
      e.preventDefault();
      return;
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
        } else if (it.type === "link") {
          const link = links[it.index];
          if (!link) return;
          link.x = (it.x || 0) + dx;
          link.y = (it.y || 0) + dy;
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
      const rawWorldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const activeLinkedBoard = activeLinkedBoardId
        ? images.find((img) => img?.id === activeLinkedBoardId)
        : null;
      const worldPos = activeLinkedBoard
        ? mapLinkedBoardWorldToSource(activeLinkedBoard, rawWorldPos)
        : rawWorldPos;
      if (isDrawingDraft) {
        const stroke = draftStrokes.find((s) => s.id === activeDraftId);
        if (!stroke) {
          isDrawing = false;
          isDrawingDraft = false;
          activeDraftId = null;
          endLocalWritingLabel();
        } else {
          stroke.points.push(worldPos);
          updateLocalWritingLabel(worldPos);
        }
      } else {
        const stroke = strokes.find((s) => s.id === activeStrokeId);
        if (!stroke) {
          isDrawing = false;
          activeStrokeId = null;
          endLocalWritingLabel();
        } else {
          stroke.points.push(worldPos);
          updateLocalWritingLabel(worldPos);
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
        if (isFrameContainer(imgObj) && frameDragOffsets) {
          applyFrameDragOffsets(
            frameDragOffsets,
            imgObj.x - frameDragOffsets.frameX,
            imgObj.y - frameDragOffsets.frameY
          );
        }
        if (isDraftBoardImage(imgObj) && draftBoardDragOffsets) {
          applyDraftBoardDragOffsets(
            draftBoardDragOffsets,
            imgObj.x - draftBoardDragOffsets.boardX,
            imgObj.y - draftBoardDragOffsets.boardY
          );
        }
      } else if (selected.type === "link") {
        const link = links[selected.index];
        link.x = worldPos.x - dragOffsetWorld.x;
        link.y = worldPos.y - dragOffsetWorld.y;
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

    if (isResizingObject && resizeInfo) {
      const worldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const dx = worldPos.x - resizeInfo.originX;
      const dy = worldPos.y - resizeInfo.originY;
      if (resizeInfo.type === "multi") {
        applyMultiResize(resizeInfo, worldPos);
      } else if (resizeInfo.type === "image" && selected) {
        const imgObj = images[resizeInfo.index];
        const anchorX = resizeInfo.anchorX ?? imgObj.x;
        const anchorY = resizeInfo.anchorY ?? imgObj.y;
        const handle = resizeInfo.handle || "br";
        if (isFrameContainer(imgObj) || isOmoteUraTagImage(imgObj)) {
          const minW = 16;
          const minH = 16;
          const newW = Math.max(Math.abs(worldPos.x - anchorX), minW);
          const newH = Math.max(Math.abs(worldPos.y - anchorY), minH);
          imgObj.x = handle === "tr" || handle === "br" ? anchorX : anchorX - newW;
          imgObj.y = handle === "bl" || handle === "br" ? anchorY : anchorY - newH;
          imgObj.width = newW;
          imgObj.height = newH;
        } else {
          const aspect = Math.max(resizeInfo.startW, 1) / Math.max(resizeInfo.startH, 1);
          const minW = 10;
          const minH = minW / aspect;
          const scaleByW = Math.abs(worldPos.x - anchorX) / Math.max(resizeInfo.startW, 1);
          const scaleByH = Math.abs(worldPos.y - anchorY) / Math.max(resizeInfo.startH, 1);
          const factor = Math.max(scaleByW, scaleByH, minW / Math.max(resizeInfo.startW, 1));
          const newW = Math.max(resizeInfo.startW * factor, minW);
          const newH = Math.max(resizeInfo.startH * factor, minH);
          imgObj.x = handle === "tr" || handle === "br" ? anchorX : anchorX - newW;
          imgObj.y = handle === "bl" || handle === "br" ? anchorY : anchorY - newH;
          imgObj.width = newW;
          imgObj.height = newH;
        }
      } else if (resizeInfo.type === "frame" && selected) {
        const fr = frames[resizeInfo.index];
        const anchorX = resizeInfo.anchorX ?? fr.x;
        const anchorY = resizeInfo.anchorY ?? fr.y;
        fr.x = Math.min(anchorX, worldPos.x);
        fr.y = Math.min(anchorY, worldPos.y);
        fr.width = Math.max(Math.abs(worldPos.x - anchorX), 10);
        fr.height = Math.max(Math.abs(worldPos.y - anchorY), 10);
      } else if (resizeInfo.type === "text" && selected) {
        const anchorX = resizeInfo.anchorX ?? resizeInfo.originX;
        const anchorY = resizeInfo.anchorY ?? resizeInfo.originY;
        const currentDistance = Math.hypot(worldPos.x - anchorX, worldPos.y - anchorY);
        const factor = Math.max(
          currentDistance / Math.max(resizeInfo.startDistance || 1, 1),
          0.05
        );
        const t = texts[resizeInfo.index];
        t.fontSize = resizeInfo.fontSize * factor;
      }
      redraw();
    }
    if (isErasing) {
      const rawWorldPos = screenToWorld(canvasPos.x, canvasPos.y);
      const linked = getLinkedBoardAtWorldPoint(rawWorldPos);
      const worldPos = linked ? mapLinkedBoardWorldToSource(linked.img, rawWorldPos) : rawWorldPos;
      eraseAt(worldPos.x, worldPos.y);
    }
  }

  function handlePointerUp(e) {
    if (screenShareFocus) {
      e.preventDefault();
      return;
    }
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
      lassoCopyActive ||
      !!linkBoardMode ||
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
        if (stroke) emitStrokeAdd(stroke);
      }
      endLocalWritingLabel();
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

    if (lassoCopyActive) {
      const path =
        lassoCopyMode === "rect" && lassoCopyPath.length >= 2
          ? makeRectPathScreen(lassoCopyPath[0], lassoCopyPath[1])
          : lassoCopyPath.slice();
      lassoCopyActive = false;
      lassoCopyPath = [];
      if (!createLassoCopySelectionFromScreenPath(path, lassoCopyMode)) {
        updateToolButtons();
        redraw();
      }
    }

    if (linkedBoardLabelDrag) {
      const drag = linkedBoardLabelDrag;
      const upPos = getCanvasPointFromEvent(e);
      const screenDistance = Math.hypot(
        upPos.x - drag.startScreen.x,
        upPos.y - drag.startScreen.y
      );
      const imgObj =
        images[drag.index]?.id === drag.id
          ? images[drag.index]
          : images.find((img) => img?.id === drag.id);
      const shouldOpenSource = !drag.moved && screenDistance <= 4;
      if (shouldOpenSource) {
        if (imgObj) {
          imgObj.x = drag.startWorld.x;
          imgObj.y = drag.startWorld.y;
        }
        isDraggingObject = false;
        frameDragOffsets = null;
        draftBoardDragOffsets = null;
        linkedBoardLabelDrag = null;
        focusLinkedBoardSource(imgObj);
        actionSnapshotTaken = false;
        return;
      }
      linkedBoardLabelDrag = null;
    }

    if (linkBoardMode === "source" && linkBoardSourceStart && linkBoardSourcePreview) {
      const source = normalizeWorldRectFromPoints(linkBoardSourceStart, linkBoardSourcePreview);
      linkBoardSourceStart = null;
      linkBoardSourcePreview = null;
      if (source.width >= 8 && source.height >= 8) {
        const offsetWorld = 24 / Math.max(scale, 0.001);
        createLinkedBoardAt(source, {
          x: source.x + offsetWorld,
          y: source.y + offsetWorld,
          width: source.width,
          height: source.height,
        });
      } else {
        linkBoardMode = null;
        pendingLinkBoardSource = null;
        updateToolButtons();
        redraw();
      }
      return;
    }

    if (linkBoardMode === "place" && pendingLinkBoardSource) {
      const upPos = getCanvasPointFromEvent(e);
      const upWorld = screenToWorld(upPos.x, upPos.y);
      const start = linkBoardPlaceStart || upWorld;
      const dx = linkBoardPlacePreview ? Math.abs((linkBoardPlacePreview.x || start.x) - start.x) : 0;
      const dy = linkBoardPlacePreview ? Math.abs((linkBoardPlacePreview.y || start.y) - start.y) : 0;
      const dest =
        dx >= 8 && dy >= 8
          ? normalizeWorldRectFromPoints(start, linkBoardPlacePreview)
          : {
              x: start.x,
              y: start.y,
              width: pendingLinkBoardSource.width,
              height: pendingLinkBoardSource.height,
            };
      createLinkedBoardAt(pendingLinkBoardSource, dest);
      linkBoardPlaceStart = null;
      linkBoardPlacePreview = null;
      updateToolButtons();
      return;
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
    const frameResizeHandled = isFrameContainer(resizedFrameImage);
    if (frameResizeHandled) {
      refreshFrameImageForCurrentSize(resizedFrameImage, { emit: socketConnected });
    }

    const selectedMembershipPatch =
      isDraggingObject && selected && !["stroke-group", "draft-group"].includes(selected.type)
        ? updateFrameMembershipForItem(selected)
        : null;
    let frameMembershipChanged = !!selectedMembershipPatch;
    const selectedGroupMembershipPatches = new Map();
    if (isDraggingObject && selected?.type === "stroke-group") {
      selected.indices.forEach((idx) => {
        const patch = updateFrameMembershipForItem({ type: "stroke", index: idx });
        if (patch) {
          selectedGroupMembershipPatches.set(idx, patch);
          frameMembershipChanged = true;
        }
      });
    } else if (isDraggingObject && selected?.type === "draft-group") {
      selected.indices.forEach((idx) => {
        const patch = updateFrameMembershipForItem({ type: "draft", index: idx });
        if (patch) {
          selectedGroupMembershipPatches.set(idx, patch);
          frameMembershipChanged = true;
        }
      });
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
            patch: { x: imgObj.x, y: imgObj.y, ...(selectedMembershipPatch || {}) },
          });
        } else if (selected.type === "link") {
          const link = links[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "link",
            id: link.id,
            patch: { x: link.x, y: link.y },
          });
        } else if (selected.type === "text") {
          const t = texts[selected.index];
          socket.emit("item:update", {
            boardId,
            type: "text",
            id: t.id,
            patch: { x: t.x, y: t.y, ...(selectedMembershipPatch || {}) },
          });
        } else if (selected.type === "stroke") {
          const s = strokes[selected.index];
          const patch = { points: s.points.map((p) => ({ x: p.x, y: p.y })), ...(selectedMembershipPatch || {}) };
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
            const patch = {
              points: s.points.map((p) => ({ x: p.x, y: p.y })),
              ...(selectedGroupMembershipPatches.get(idx) || {}),
            };
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
              patch: { x: imgObj.x, y: imgObj.y, width: imgObj.width, height: imgObj.height },
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

    if (isDraggingObject && selected?.type === "image" && frameDragOffsets) {
      emitFrameDragUpdates(frameDragOffsets);
    }

    if (isDraggingObject && selected?.type === "image" && draftBoardDragOffsets) {
      emitDraftBoardDragUpdates(draftBoardDragOffsets);
    }

    if (isResizingObject && resizeInfo?.type === "multi") {
      emitMultiResizeUpdates(resizeInfo.items);
    }

    isDrawing = false;
    isPanning = false;
    isDraggingObject = false;
    isResizingObject = false;
    draftBoardDragOffsets = null;
    activeLinkedBoardId = null;
    if (multiDragActive && multiDragOffsets) {
      const multiMembershipPatches = new Map();
      multiDragOffsets.forEach((it) => {
        if (!it) return;
        if (it.type === "stroke" || it.type === "text" || it.type === "image" || it.type === "draft") {
          const patch = updateFrameMembershipForItem({ type: it.type, index: it.index });
          if (patch) {
            multiMembershipPatches.set(`${it.type}:${it.index}`, patch);
            frameMembershipChanged = true;
          }
        } else if (it.type === "stroke-group") {
          it.indices.forEach((idx) => {
            const patch = updateFrameMembershipForItem({ type: "stroke", index: idx });
            if (patch) {
              multiMembershipPatches.set(`stroke:${idx}`, patch);
              frameMembershipChanged = true;
            }
          });
        } else if (it.type === "draft-group") {
          it.indices.forEach((idx) => {
            const patch = updateFrameMembershipForItem({ type: "draft", index: idx });
            if (patch) {
              multiMembershipPatches.set(`draft:${idx}`, patch);
              frameMembershipChanged = true;
            }
          });
        }
      });
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
                patch: {
                  points: s.points.map((p) => ({ x: p.x, y: p.y })),
                  ...(multiMembershipPatches.get(`stroke:${it.index}`) || {}),
                },
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
                patch: {
                  points: s.points.map((p) => ({ x: p.x, y: p.y })),
                  ...(multiMembershipPatches.get(`stroke:${idx}`) || {}),
                },
              });
            });
          } else if (it.type === "text") {
            const t = texts[it.index];
            if (t) {
              socket.emit("item:update", {
                boardId,
                type: "text",
                id: t.id,
                patch: { x: t.x, y: t.y, ...(multiMembershipPatches.get(`text:${it.index}`) || {}) },
              });
            }
          } else if (it.type === "link") {
            const link = links[it.index];
            if (link) {
              socket.emit("item:update", {
                boardId,
                type: "link",
                id: link.id,
                patch: { x: link.x, y: link.y },
              });
            }
          } else if (it.type === "image") {
            const img = images[it.index];
            if (img) {
              socket.emit("item:update", {
                boardId,
                type: "image",
                id: img.id,
                patch: { x: img.x, y: img.y, ...(multiMembershipPatches.get(`image:${it.index}`) || {}) },
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

    if (frameMembershipChanged) {
      redraw();
    }

    isErasing = false;
    activeStrokeId = null;
    activeDraftId = null;
    isDrawingDraft = false;
    resizeInfo = null;
    frameDragOffsets = null;
    draftBoardDragOffsets = null;
    linkedBoardLabelDrag = null;
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
        const tabHit = hitTestFrameTabControl(
          rightButtonStart?.canvas?.x ?? canvasPos.x,
          rightButtonStart?.canvas?.y ?? canvasPos.y
        );
        if (tabHit?.action === "tab") {
          selected = { type: "image", index: tabHit.index };
          multiSelection = null;
          showContextMenu(e.clientX, e.clientY, { frameTabTarget: tabHit });
          rightButtonDown = false;
          rightButtonStart = null;
          return;
        }
        if (hitTestLassoCopySelectionScreen(rightButtonStart?.canvas || canvasPos)) {
          selected = null;
          multiSelection = null;
          showContextMenu(e.clientX, e.clientY, { lassoCopySelection: true });
          rightButtonDown = false;
          rightButtonStart = null;
          return;
        }
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
      if (!canCreateOnCurrentLayer()) {
        isDrawingShape = false;
        shapeStart = null;
        shapePreview = null;
        shapeTargetLayer = null;
        return;
      }
      const upPos = getCanvasPointFromEvent(e);
      const worldPos = screenToWorld(upPos.x, upPos.y);
      const layer = shapeTargetLayer || getShapeTargetLayer();
      const createdStrokeIndices = [];
      const addShapeStroke = (points, opts = {}) => {
        const stroke = createStroke(points, layer, opts);
        if (!stroke) return null;
        const index = strokes.findIndex((item) => item?.id === stroke.id);
        if (index >= 0) createdStrokeIndices.push(index);
        return stroke;
      };
      if (shapeMode === "line") {
        addShapeStroke(
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
        addShapeStroke(
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
          addShapeStroke(
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
          addShapeStroke(
            [
              { x, y: y0 },
              { x, y: y1 },
            ],
            layer,
            { groupId }
          );
        }
      }
      if (createdStrokeIndices.length === 1) {
        selected = { type: "stroke", index: createdStrokeIndices[0] };
        multiSelection = null;
      } else if (createdStrokeIndices.length > 1) {
        const firstStroke = strokes[createdStrokeIndices[0]];
        selected = null;
        multiSelection = {
          items: [{ type: "stroke-group", groupId: firstStroke?.groupId || null, indices: createdStrokeIndices }],
          rectWorld: getSelectionWorldBounds([{ type: "stroke-group", indices: createdStrokeIndices }]),
        };
      }
      isDrawingShape = false;
      shapeStart = null;
      shapePreview = null;
      shapeTargetLayer = null;
      updateFooterByState();
      redraw();
    }

    if (isPlacingFrame && framePlaceStart) {
      if (!canCreateOnCurrentLayer()) {
        isPlacingFrame = false;
        framePlaceType = null;
        framePlaceStart = null;
        framePlacePreview = null;
        return;
      }
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
      const shouldFitViewportToDrag = placedFrameType !== "omoteura";
      const frameHeight = shouldFitViewportToDrag
        ? getFrameTotalHeightForViewportHeight(height)
        : height;
      const frameHeaderH = shouldFitViewportToDrag
        ? getFrameHeaderHeightWorld({ height: frameHeight })
        : 0;
      const frameX = placeX;
      const frameY = shouldFitViewportToDrag ? placeY - frameHeaderH : placeY;
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
      const dataUrl = createFrameTag(placedFrameType, width * scale, frameHeight * scale, label);
      const img = new Image();
      const frameContentOptions = activeLayer === "user" ? { adoptLayer: "user" } : {};
      img.onload = () => {
        const isOmoteUraImage = placedFrameType === "omoteura";
        const imgObj = {
          id: genId(),
          img,
          src: dataUrl,
          x: frameX,
          y: frameY,
          width,
          height: frameHeight,
          layer: "image",
          order: orderCounter++,
          user: currentUser,
          rotation: 0,
          tagType: placedFrameType,
          tagLabel: isOmoteUraImage ? "vertical" : label,
          imageName: label,
          imageListOrder: bumpImageListOrderCounter(),
          frameTabs: isOmoteUraImage ? null : [{ id: "tab-1", name: "1" }],
          activeFrameTab: isOmoteUraImage ? null : "tab-1",
        };
        const backOrder = getBackOrderForFrameContainingExistingFrames(imgObj);
        if (typeof backOrder === "number") {
          imgObj.order = backOrder;
        }
        if (isOmoteUraImage) {
          const imageBackOrder = getBackOrderBehindOverlappingImages(imgObj);
          if (typeof imageBackOrder === "number") {
            imgObj.order = imageBackOrder;
          }
        }
        const parentMembership = getFrameMembershipForBounds(getImageBoundsWorld(imgObj), imgObj.id);
        if (parentMembership) {
          imgObj.frameId = parentMembership.frameId;
          imgObj.frameTab = parentMembership.frameTab;
        }
        images.push(imgObj);
        const frameIndex = images.length - 1;
        registerUser(currentUser);
        refreshImageList();
        emitImageAdd(imgObj);
        addCroppedImageBackgroundsToNewFrame(imgObj, frameContentOptions);
        assignExistingObjectsToNewFrame(imgObj, frameContentOptions);
        selected = { type: "image", index: frameIndex };
        multiSelection = null;
        updateFooterByState();
        redraw();
      };
      img.src = dataUrl;

      isPlacingFrame = false;
      framePlaceType = null;
      framePlaceStart = null;
      framePlacePreview = null;
      currentTool = "select";
      updateToolButtons();
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
      e.dataTransfer.dropEffect = isCreationLockedLayer() ? "none" : "copy";
    }
  }

  function handleImageDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = getImageFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) return;
    if (!canCreateOnCurrentLayer()) return;
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
    const target = e.target;
    if (
      target &&
      (target === textEditor ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

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
        if (!canCreateOnCurrentLayer()) return;
        addImageFile(file, worldPos.x, worldPos.y, null, getImageTargetLayer());
      }
      return;
    }

    const text = clipboard.getData("text");
    if (text) {
      e.preventDefault();
      if (activeLayer === "image") return;
      if (!requireUser()) return;
      if (!canCreateOnCurrentLayer()) return;
      const url = extractSingleUrl(text);
      if (url) {
        addLinkFromClipboard(url, worldPos.x, worldPos.y);
        return;
      }
      addTextFromClipboard(text, worldPos.x, worldPos.y);
    }
  });

  // --- イベント登録 ---
  function suppressBoardContextMenu(e) {
    const target = e.target;
    const isBoardContext =
      target === canvas ||
      (container && container.contains(target)) ||
      (contextMenu && contextMenu.contains(target));
    if (!isBoardContext) return;
    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener("contextmenu", suppressBoardContextMenu, true);
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  canvas.addEventListener("click", () => hideMenusIfCompact());
  canvas.addEventListener("pointerdown", () => {
    if (draftBoardViewId || linkBoardView || followTargetUser) return;
    document.querySelectorAll(".floating-app-window.active").forEach((frame) => {
      frame.classList.remove("active");
    });
  });

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

  function closeListMenu() {
    if (listMenu) listMenu.classList.add("hidden");
  }

  function openListMenu() {
    if (listMenu) listMenu.classList.remove("hidden");
  }

  function renderWatchUsersMenu() {
    if (!watchUsersMenu) return;
    watchUsersMenu.innerHTML = "";
    if (!onlineUsers.length) {
      const empty = document.createElement("div");
      empty.className = "watch-users-empty";
      empty.textContent = "現在いるユーザーはいません";
      watchUsersMenu.appendChild(empty);
      return;
    }
    onlineUsers.forEach((user) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = user === currentUser ? `${user}（自分）` : user;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        openFloatingTrackingWindow(user);
        watchUsersMenu.classList.add("hidden");
      });
      watchUsersMenu.appendChild(button);
    });
  }

  function openWatchUsersMenu() {
    closeListMenu();
    closeOtherMenu();
    if (textToolMenu) textToolMenu.classList.add("hidden");
    renderWatchUsersMenu();
    watchUsersMenu?.classList.remove("hidden");
  }

  function closeWatchUsersMenu() {
    watchUsersMenu?.classList.add("hidden");
  }

  function openOtherMenu() {
    if (otherMenu) {
      if (otherMenu._closeTimer) {
        clearTimeout(otherMenu._closeTimer);
        otherMenu._closeTimer = null;
      }
      if (textToolMenu) textToolMenu.classList.add("hidden");
      closeListMenu();
      closeInsertMenu();
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

  function startScreenShareDrag(e) {
    if (!screenShareView || screenShareFocus || !activeScreenShareSocketId) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target === screenShareToggleBtn) return;
    const rect = screenShareView.getBoundingClientRect();
    screenShareDrag = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: rect.left,
      startY: rect.top,
      moved: false,
    };
    screenShareView.setPointerCapture?.(e.pointerId);
  }

  function moveScreenShareDrag(e) {
    if (!screenShareDrag || screenShareDrag.pointerId !== e.pointerId) return;
    const dx = e.clientX - screenShareDrag.startClientX;
    const dy = e.clientY - screenShareDrag.startClientY;
    if (!screenShareDrag.moved && Math.hypot(dx, dy) < 4) return;
    screenShareDrag.moved = true;
    screenShareWindowPosition = clampScreenSharePosition({
      x: screenShareDrag.startX + dx,
      y: screenShareDrag.startY + dy,
    });
    applyScreenShareWindowPosition();
    e.preventDefault();
  }

  function endScreenShareDrag(e) {
    if (!screenShareDrag || screenShareDrag.pointerId !== e.pointerId) return;
    if (screenShareDrag.moved) {
      suppressNextScreenShareClick = true;
      e.preventDefault();
    }
    screenShareView?.releasePointerCapture?.(e.pointerId);
    screenShareDrag = null;
  }

  canvas.addEventListener("mousedown", handlePointerDown);
  canvas.addEventListener("mousemove", handlePointerMove);
  canvas.addEventListener("mouseleave", hideFrameTabTooltip);
  if (screenShareView) {
    screenShareView.addEventListener("pointerdown", startScreenShareDrag);
    screenShareView.addEventListener("pointermove", moveScreenShareDrag);
    screenShareView.addEventListener("pointerup", endScreenShareDrag);
    screenShareView.addEventListener("pointercancel", endScreenShareDrag);
    screenShareView.addEventListener("click", (e) => {
      if (suppressNextScreenShareClick) {
        suppressNextScreenShareClick = false;
        e.preventDefault();
        return;
      }
      if (!activeScreenShareSocketId) return;
      screenShareFocus = !screenShareFocus;
      updateScreenShareLayout();
    });
  }
  if (screenShareToggleBtn) {
    screenShareToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleScreenShareBroadcast();
    });
  }
  container.addEventListener("click", () => {
    if (!screenShareFocus) return;
    screenShareFocus = false;
    updateScreenShareLayout();
  });
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
    if (e.key === "Alt") {
      activeAltSide = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? "right" : "left";
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

    if (handleHiddenCommandKey(e)) return;

    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.metaKey &&
      e.key.toLowerCase() === "s"
    ) {
      if (toggleSelectedTextStarLabel()) {
        e.preventDefault();
        altArrowShortcutUsed = true;
      }
      return;
    }

    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.metaKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
      selectionHasMirrorTarget()
    ) {
      e.preventDefault();
      altArrowShortcutUsed = true;
      toggleSelectedImageMirror();
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
    if (handleScreenShareBoardPreviewInput(e)) return;
    if (ignoreNextDblClick) {
      ignoreNextDblClick = false;
      e.preventDefault();
      return;
    }
    if (textEditor) return;
    e.preventDefault();
    const canvasPos = getCanvasPointFromEvent(e);
    const tabHit = hitTestFrameTabControl(canvasPos.x, canvasPos.y);
    if (tabHit) {
      if (tabHit.action === "tab") {
        selected = { type: "image", index: tabHit.index };
        multiSelection = null;
        editFrameTabName(tabHit.frame, tabHit.tabId);
      }
      return;
    }
    const textIndex = hitTestText(canvasPos.x, canvasPos.y);
    if (textIndex >= 0) {
      selected = { type: "text", index: textIndex };
      multiSelection = null;
      currentTool = "select";
      updateToolButtons();
      redraw();
      editTextAt(textIndex);
      return;
    }
    const frameIndex = hitTestFrameLabel(canvasPos.x, canvasPos.y);
    if (frameIndex >= 0 && editFrameLabelAt(frameIndex)) {
      return;
    }
    const linkOpenIndex = hitTestLinkOpenButton(canvasPos.x, canvasPos.y);
    if (linkOpenIndex >= 0) {
      window.open(links[linkOpenIndex].url, "_blank", "noopener");
      return;
    }
    const linkIndex = hitTestLink(canvasPos.x, canvasPos.y);
    if (linkIndex >= 0) {
      window.open(links[linkIndex].url, "_blank", "noopener");
      return;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
      const releasedSide = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? "right" : "left";
      const shouldRotateOnAltRelease =
        activeAltSide === releasedSide &&
        !altArrowShortcutUsed &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        !textEditor &&
        getSelectionItems().length > 0;
      if (shouldRotateOnAltRelease) {
        const target = e.target;
        const isInputTarget =
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!isInputTarget) {
          e.preventDefault();
          handleAltSelectionAction(releasedSide === "right" ? "ccw" : "cw");
        }
      }
      if (activeAltSide === releasedSide) activeAltSide = null;
      altArrowShortcutUsed = false;
    }
    if (attentionActive && !(e.ctrlKey && e.altKey && e.shiftKey)) {
      endAttention();
    }
  });

  window.addEventListener("blur", () => {
    activeAltSide = null;
    altArrowShortcutUsed = false;
    endLocalWritingLabel();
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

  function getSelectionItemKey(item) {
    if (!item) return "";
    if (item.type === "stroke") return `stroke:${strokes[item.index]?.id || item.index}`;
    if (item.type === "text") return `text:${texts[item.index]?.id || item.index}`;
    if (item.type === "image") return `image:${images[item.index]?.id || item.index}`;
    if (item.type === "link") return `link:${links[item.index]?.id || item.index}`;
    if (item.type === "draft") return `draft:${draftStrokes[item.index]?.id || item.index}`;
    if (item.type === "stroke-group") {
      return `stroke-group:${item.indices.map((idx) => strokes[idx]?.id || idx).sort().join(",")}`;
    }
    if (item.type === "draft-group") {
      return `draft-group:${item.indices.map((idx) => draftStrokes[idx]?.id || idx).sort().join(",")}`;
    }
    return `${item.type}:${item.index ?? ""}`;
  }

  function setSelectionFromItems(items) {
    const unique = [];
    const seen = new Set();
    (items || []).forEach((item) => {
      const key = getSelectionItemKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

    if (unique.length === 0) {
      selected = null;
      multiSelection = null;
    } else if (unique.length === 1) {
      selected = unique[0];
      multiSelection = null;
    } else {
      selected = null;
      multiSelection = {
        items: unique,
        rectWorld: getSelectionWorldBounds(unique),
      };
    }
    redraw();
    updateFooterByState();
  }

  function hitTestSelectableItem(canvasPos) {
    const hit = hitTestTopSelectableRawItem(canvasPos);
    if (!hit) return null;
    if (hit.type === "stroke") return getStrokeGroupSelection(hit.index);
    if (hit.type === "draft") return getDraftGroupSelection(hit.index);
    return hit;
  }

  function hitTestTopSelectableRawItem(canvasPos) {
    const candidates = [];
    const addCandidate = (item) => {
      const info = getHitDrawInfoForItem(item);
      if (info) candidates.push(info);
    };
    const worldPoint = screenToWorld(canvasPos.x, canvasPos.y);
    const tolWorld = 6 / scale;

    links.forEach((link, index) => {
      if (!link || !isLinkVisible(link) || !canInteractLink(link)) return;
      if (pointInRectWorld(getLinkBoundsWorld(link), worldPoint)) addCandidate({ type: "link", index });
    });

    texts.forEach((text, index) => {
      if (!text || !isTextVisible(text) || !canInteractText(text)) return;
      const bounds = getTextBoundsWorld(text);
      if (pointInRotatedRectWorld(worldPoint, bounds, text.rotation || 0)) addCandidate({ type: "text", index });
    });

    images.forEach((imgObj, index) => {
      if (!imgObj || !canInteractImage(imgObj)) return;
      if (isFrameContainer(imgObj)) {
        const headerHit = getFrameHeaderHitBoundsScreen(imgObj);
        const headerBounds = getFrameHeaderBoundsWorld(imgObj);
        if (
          pointInScreenRect({ x: canvasPos.x, y: canvasPos.y }, headerHit) ||
          (headerBounds && pointInRotatedRectWorld(worldPoint, headerBounds, imgObj.rotation || 0))
        ) {
          addCandidate({ type: "image", index });
        }
        return;
      }
      if (isImageCoveredByHigherFrameAtPoint(imgObj, index, worldPoint)) return;
      const bounds = getImageBoundsWorld(imgObj);
      if (bounds && pointInRotatedRectWorld(worldPoint, bounds, imgObj.rotation || 0)) {
        addCandidate({ type: "image", index });
      }
    });

    strokes.forEach((stroke, index) => {
      if (!stroke || !stroke.points || !isStrokeVisible(stroke) || !canInteractStroke(stroke)) return;
      const bounds = getStrokeBoundsWorld(stroke);
      if (!bounds || !pointInRectWorld(bounds, worldPoint)) return;
      if (stroke.fill && pointInPolygon(worldPoint, stroke.points)) {
        addCandidate({ type: "stroke", index });
        return;
      }
      const tol = Math.max(tolWorld, (stroke.size || 1) / scale / 2);
      if (isPointNearStroke(stroke, worldPoint, tol)) addCandidate({ type: "stroke", index });
    });

    if (activeLayer === "draft") {
      draftStrokes.forEach((stroke, index) => {
        if (!stroke || !stroke.points || stroke.user !== currentUser) return;
        const bounds = getStrokeBoundsWorld(stroke);
        if (!bounds || !pointInRectWorld(bounds, worldPoint)) return;
        if (stroke.fill && pointInPolygon(worldPoint, stroke.points)) {
          addCandidate({ type: "draft", index });
          return;
        }
        const tol = Math.max(tolWorld, (stroke.size || 1) / scale / 2);
        if (isPointNearStroke(stroke, worldPoint, tol)) addCandidate({ type: "draft", index });
      });
    }

    if (!candidates.length) return null;
    candidates.sort(compareHitDrawOrder);
    return candidates[candidates.length - 1].item;
  }

  function hitTestLink(screenX, screenY) {
    const worldPoint = screenToWorld(screenX, screenY);
    for (let i = links.length - 1; i >= 0; i--) {
      const link = links[i];
      if (!link || !isLinkVisible(link) || !canInteractLink(link)) continue;
      if (pointInRectWorld(getLinkBoundsWorld(link), worldPoint)) return i;
    }
    return -1;
  }

  function hitTestLinkOpenButton(screenX, screenY) {
    const point = { x: screenX, y: screenY };
    for (let i = links.length - 1; i >= 0; i--) {
      const link = links[i];
      if (!link || !isLinkVisible(link) || !canInteractLink(link)) continue;
      if (pointInScreenRect(point, getLinkOpenButtonBoundsScreen(link))) return i;
    }
    return -1;
  }

  function toggleSelectionAtPoint(canvasPos) {
    const item = hitTestSelectableItem(canvasPos);
    if (!item) return false;
    const key = getSelectionItemKey(item);
    const current = getSelectionItems();
    const exists = current.some((it) => getSelectionItemKey(it) === key);
    setSelectionFromItems(exists ? current.filter((it) => getSelectionItemKey(it) !== key) : [...current, item]);
    return true;
  }

  function selectAtPoint(canvasPos) {
    // テキストリサイズ
    const textHandle = hitTestTextResizeHandle(canvasPos.x, canvasPos.y);
    if (textHandle) {
      selected = { type: "text", index: textHandle.index };
      multiSelection = null;
      redraw();
      return true;
    }
    // 画像リサイズ
    const imgHandle = hitTestImageResizeHandle(canvasPos.x, canvasPos.y);
    if (imgHandle) {
      selected = { type: "image", index: imgHandle.index };
      multiSelection = null;
      redraw();
      return true;
    }
    // テキスト本体
    const item = hitTestSelectableItem(canvasPos);
    if (item) {
      setSelectionFromItems([item]);
      return true;
    }
    return false;
  }

  function selectionHasDraft() {
    return getSelectionItems().some((it) => {
      if (it.type === "draft" || it.type === "draft-group") return true;
      if (it.type !== "text") return false;
      const text = texts[it.index];
      return !!text && (text.layer || "user") === "draft" && text.user === currentUser;
    });
  }

  function selectionHasStrokeOrText() {
    return getSelectionItems().some((it) => it.type === "stroke" || it.type === "stroke-group" || it.type === "text");
  }

  function selectionHasBaseMoveTarget() {
    return getSelectionItems().some((it) => {
      if (it.type === "stroke" || it.type === "stroke-group" || it.type === "text") return true;
      if (it.type !== "image") return false;
      const img = images[it.index];
      return !!img && (img.layer || "user") !== "base";
    });
  }

  function selectionHasImage() {
    return getSelectionItems().some((it) => it.type === "image");
  }

  function getSelectedImageIndices() {
    const seen = new Set();
    return getSelectionItems()
      .filter((it) => it.type === "image" && images[it.index])
      .map((it) => it.index)
      .filter((index) => {
        const id = images[index]?.id || index;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  function selectionHasImageTabTarget() {
    return getSelectedImageIndices().length > 0;
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
      const oldName = imgObj.imageName || "";
      imgObj.imageName = imageName;
      emitItemPatch("image", imgObj, { imageName });
      updateTextTagsForRenamedImage(imgObj, oldName, imageName);
      syncImageNameToLinkedFrames(imgObj, imageName);
    });
    refreshImageList();
  }

  function selectionHasMirrorTarget() {
    return getSelectionItems().some((it) => it.type === "image" && images[it.index] && !isFrameContainer(images[it.index]));
  }

  function toggleSelectedImageMirror() {
    const targets = getSelectedImages().filter((img) => !isFrameContainer(img));
    if (!targets.length) return false;
    ensureSnapshotForAction();
    const nextMirrored = !targets.every((img) => !!img.mirrored);
    targets.forEach((imgObj) => {
      imgObj.mirrored = nextMirrored;
      emitItemPatch("image", imgObj, { mirrored: imgObj.mirrored });
    });
    redraw();
    return true;
  }

  function selectionHasOrderable() {
    return collectOrderableSelectionItems().length > 0;
  }

  function selectionHasRotatable() {
    return getSelectionItems().some((it) => {
      if (it.type === "image") return !isFrameContainer(images[it.index]);
      return it.type === "stroke" || it.type === "stroke-group" || it.type === "draft" || it.type === "draft-group" || it.type === "text";
    });
  }

  function selectionHasDraftCopyTarget() {
    return getSelectionItems().some((it) => it.type === "stroke" || it.type === "stroke-group" || it.type === "text");
  }

  function selectionHasFrameBackgroundMoveTarget() {
    return getSelectionItems().some((it) => {
      if (it.type === "image" && isFrameContainer(images[it.index])) return false;
      if (it.type === "stroke-group") {
        return it.indices.some((idx) => !!getFrameBackgroundMovePatch({ type: "stroke", index: idx }));
      }
      if (it.type === "draft-group") {
        return it.indices.some((idx) => !!getFrameBackgroundMovePatch({ type: "draft", index: idx }));
      }
      return !!getFrameBackgroundMovePatch(it);
    });
  }

  function getSelectedFrameItems() {
    return getSelectionItems().filter((it) => it.type === "image" && isFrameContainer(images[it.index]));
  }

  function getFrameContentItemsDeep(frameImg, seenFrameIds = new Set()) {
    if (!isFrameContainer(frameImg) || seenFrameIds.has(frameImg.id)) return [];
    seenFrameIds.add(frameImg.id);
    const contents = getFrameContentItems(frameImg);
    const result = [];
    contents.forEach((item) => {
      result.push(item);
      if (item.type === "image") {
        const img = images[item.index];
        if (isFrameContainer(img)) result.push(...getFrameContentItemsDeep(img, seenFrameIds));
      }
    });
    return result;
  }

  function selectionHasFrameContentsTarget() {
    return getSelectedFrameItems().some((it) => getFrameContentItemsDeep(images[it.index]).length > 0);
  }

  function selectSelectedFrameContents() {
    const frameItems = getSelectedFrameItems();
    if (!frameItems.length) return;
    const contents = [];
    frameItems.forEach((item) => {
      contents.push(...getFrameContentItemsDeep(images[item.index]));
    });
    setSelectionFromItems(contents);
  }

  function updateToolButtons() {
    const creationLocked = isCreationLockedLayer();
    const isPen = currentTool === "pen";
    const isFill = currentTool === "fill";
    const isEraser = currentTool === "eraser";
    const isLassoCopy = currentTool === "lasso-copy";
    const isInsertMode = !!shapeMode || !!framePlaceType || !!linkBoardMode;
    const isSelect = currentTool === "select" && !isInsertMode && !pendingTextMode && !pendingTextListGridCopies;
    if (penToolBtn) {
      penToolBtn.disabled = creationLocked || isPen;
      penToolBtn.classList.toggle("active", isPen);
      penToolBtn.title = creationLocked ? "このレイヤーではペンは使えません" : "ペン";
    }
    if (fillToolBtn) {
      fillToolBtn.disabled = creationLocked || isFill;
      fillToolBtn.classList.toggle("active", isFill);
      fillToolBtn.title = creationLocked ? "このレイヤーでは塗りつぶしは使えません" : "塗りつぶし";
    }
    if (eraserToolBtn) {
      eraserToolBtn.disabled = isEraser;
      eraserToolBtn.classList.toggle("active", isEraser);
    }
    if (selectToolBtn) {
      selectToolBtn.disabled = isSelect;
      selectToolBtn.classList.toggle("active", isSelect);
    }
    if (lassoCopyToolBtn) {
      lassoCopyToolBtn.disabled = creationLocked;
      lassoCopyToolBtn.classList.toggle("active", isLassoCopy);
      lassoCopyToolBtn.title = creationLocked
        ? "このレイヤーでは投げ縄スクショは使えません"
        : `投げ縄スクショ（${lassoCopyMode === "rect" ? "四角形" : "フリーハンド"}）`;
    }
    if (textToolBtn) {
      textToolBtn.disabled = creationLocked;
      textToolBtn.classList.toggle("active", !!pendingTextMode || !!pendingTextListGridCopies);
      textToolBtn.title = creationLocked ? "このレイヤーでは文字入力は使えません" : "文字入力";
    }
    if (insertMenuBtn) {
      insertMenuBtn.disabled = creationLocked;
      insertMenuBtn.classList.toggle("active", isInsertMode);
      insertMenuBtn.title = creationLocked ? "このレイヤーでは挿入は使えません" : "挿入";
    }
    if (otherMenuBtn) {
      otherMenuBtn.classList.toggle("active", isInsertMode || isFill);
    }
    if (currentTool === "pen" || currentTool === "eraser" || currentTool === "fill" || currentTool === "lasso-copy") {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "default";
    }
    syncToolbarToActiveDraftBoard();
  }
  updateToolButtons();

  function clearPendingTextMode() {
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    if (textToolMenu) textToolMenu.classList.add("hidden");
    updateToolButtons();
  }

  function switchToSelectTool() {
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    currentTool = "select";
    updateToolButtons();
  }

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
    syncToolbarToActiveDraftBoard();
  }

  function undoLast() {
    if (!historyStack.length) return;
    const before = cloneState();
    const snap = historyStack.pop();
    const restored = buildUndoSnapshot(before, snap);
    restoreSnapshot(restored);
    syncRestoredSnapshot(before, restored);
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
      linkUserToBoardServer(currentUser);
      identifyToServer();
      redraw();
    });
  });

  sizeRange.addEventListener("input", () => {
    currentSize = parseInt(sizeRange.value, 10);
    sizeLabel.textContent = currentSize;
    syncToolbarToActiveDraftBoard();
  });

  penToolBtn.addEventListener("click", () => {
    if (!canCreateOnCurrentLayer()) return;
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    currentTool = "pen";
    lastUserLayerTool = "pen";
    selected = null;
    clearLassoCopySelection();
    updateToolButtons();
    redraw();
    showTransientFooterMessage("ペン：このレイヤーに描いた線は共有されます。", 5000);
    resetShapeMode();
  });

  if (fillToolBtn) {
    fillToolBtn.addEventListener("click", () => {
      if (!requireUser()) return;
      if (!canCreateOnCurrentLayer()) return;
      if (activeLayer === "image") {
        setActiveLayer(isAdminUser() ? "admin" : "user");
      }
      pendingTextListGridCopies = null;
      pendingTextMode = null;
      currentTool = "fill";
      lastUserLayerTool = "fill";
      selected = null;
      clearLassoCopySelection();
      updateToolButtons();
      redraw();
      showTransientFooterMessage("塗りつぶし：閉じた線の内側をクリックしてください。", 5000);
      resetShapeMode();
      closeOtherMenu();
    });
  }

  eraserToolBtn.addEventListener("click", () => {
    if (!requireUser()) return;
    if (activeLayer === "image") {
      setActiveLayer(isAdminUser() ? "admin" : "user");
    }
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    currentTool = "eraser";
    lastUserLayerTool = "eraser";
    selected = null;
    clearLassoCopySelection();
    updateToolButtons();
    showTransientFooterMessage("消しゴム：線に触れると一筆単位で削除されます。画像やテキストは消えません。", 5000);
    resetShapeMode();
  });

  selectToolBtn.addEventListener("click", () => {
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    currentTool = "select";
    lassoCopyActive = false;
    lassoCopyPath = [];
    updateToolButtons();
    showTransientFooterMessage("選択ツール：右クリックでメニューを開けます。", 5000);
    resetShapeMode();
  });

  function startLassoCopyTool(mode = lassoCopyMode) {
      if (!requireUser()) return;
      if (!canCreateOnCurrentLayer()) return;
      pendingTextListGridCopies = null;
      pendingTextMode = null;
      lassoCopyActive = false;
      lassoCopyPath = [];
      lassoCopySelection = null;
      lassoCopyMode = mode === "rect" ? "rect" : "freehand";
      currentTool = "lasso-copy";
      updateToolButtons();
      showTransientFooterMessage(
        `投げ縄スクショ（${lassoCopyMode === "rect" ? "四角形" : "フリーハンド"}）：範囲を選択して右クリックメニューを開いてください。`,
        6000
      );
      resetShapeMode();
      redraw();
  }

  if (lassoCopyToolBtn) {
    lassoCopyToolBtn.addEventListener("click", () => {
      startLassoCopyTool();
    });
  }

  if (lassoCopyToolBtn && lassoCopyToolMenu) {
    const openLassoCopyToolMenu = () => {
      if (isCreationLockedLayer()) return;
      if (textToolMenu) textToolMenu.classList.add("hidden");
      closeListMenu();
      closeOtherMenu();
      lassoCopyToolMenu.classList.remove("hidden");
    };
    const closeLassoCopyToolMenu = () => {
      lassoCopyToolMenu.classList.add("hidden");
    };
    lassoCopyToolBtn.addEventListener("mouseenter", openLassoCopyToolMenu);
    lassoCopyToolMenu.addEventListener("mouseenter", openLassoCopyToolMenu);
    lassoCopyToolBtn.addEventListener("mouseleave", () => setTimeout(() => {
      if (!lassoCopyToolMenu.matches(":hover") && !lassoCopyToolBtn.matches(":hover")) closeLassoCopyToolMenu();
    }, 120));
    lassoCopyToolMenu.addEventListener("mouseleave", () => setTimeout(() => {
      if (!lassoCopyToolMenu.matches(":hover") && !lassoCopyToolBtn.matches(":hover")) closeLassoCopyToolMenu();
    }, 120));
    lassoCopyToolMenu.querySelectorAll("button[data-lasso-copy-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        startLassoCopyTool(btn.getAttribute("data-lasso-copy-mode"));
        closeLassoCopyToolMenu();
      });
    });
  }

  textListBtn.addEventListener("click", toggleTextListPanelView);

  if (imageListBtn) {
    imageListBtn.addEventListener("click", toggleImageListPanelView);
  }

  if (linkListBtn) {
    linkListBtn.addEventListener("click", toggleLinkListPanelView);
  }

  textListCloseBtn.addEventListener("click", () => {
    closeTextList();
  });

  if (imageListCloseBtn) {
    imageListCloseBtn.addEventListener("click", () => {
      closeImageList();
    });
  }

  if (linkListCloseBtn) {
    linkListCloseBtn.addEventListener("click", () => {
      closeLinkList();
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

  if (textListDuplicateGridBtn) {
    textListDuplicateGridBtn.addEventListener("click", duplicateSelectedTextListAsGrid);
  }

  if (textListSortTagBtn) {
    textListSortTagBtn.addEventListener("click", sortTextListByTag);
  }

  if (textListSortKanaBtn) {
    textListSortKanaBtn.addEventListener("click", sortTextListByKana);
  }

  if (textListSortCreatedBtn) {
    textListSortCreatedBtn.addEventListener("click", sortTextListByCreated);
  }

  if (textListStarOnly) {
    textListStarOnly.addEventListener("change", () => {
      textListStarOnlyEnabled = textListStarOnly.checked;
      renderTextList();
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
    contextFrameTabTarget = null;
  }

  function positionContextMenu(x, y) {
    if (!contextMenu) return;
    const margin = 8;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.visibility = "hidden";
    contextMenu.classList.remove("hidden");
    const rect = contextMenu.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = Math.min(Math.max(margin, x), maxLeft);
    const top = Math.min(Math.max(margin, y), maxTop);
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.visibility = "";
  }

  function showContextMenu(x, y, options = {}) {
    if (!contextMenu) return;
    contextFrameTabTarget = options.frameTabTarget || null;
    if (options.lassoCopySelection) {
      contextMenu.querySelectorAll("button").forEach((btn) => {
        const action = btn.getAttribute("data-action");
        const isLassoAction =
          action === "lasso-copy" ||
          action === "lasso-link-board" ||
          action === "lasso-draft-board";
        btn.classList.toggle("hidden", !isLassoAction);
        btn.classList.remove("disabled");
      });
      positionContextMenu(x, y);
      return;
    }
    const deleteFrameTabBtn = contextMenu.querySelector('button[data-action="delete-frame-tab"]');
    if (contextFrameTabTarget) {
      contextMenu.querySelectorAll("button").forEach((btn) => {
        const isDeleteTab = btn.getAttribute("data-action") === "delete-frame-tab";
        btn.classList.toggle("hidden", !isDeleteTab);
        btn.classList.remove("disabled");
      });
      const tabs = ensureFrameTabs(contextFrameTabTarget.frame);
      if (deleteFrameTabBtn && tabs.length <= 1) deleteFrameTabBtn.classList.add("disabled");
      positionContextMenu(x, y);
      return;
    }

    const hasDraft = selectionHasDraft();
    const selectionItems = getSelectionItems();
    const hasAny = selectionItems.length > 0;
    const hasImage = selectionHasImage();
    const hasMirrorTarget = selectionHasMirrorTarget();
    const hasMoveTarget = selectionHasBaseMoveTarget();
    const hasMoveImageTarget = hasImage && isAdminUser();
    const hasOrderable = selectionHasOrderable();
    const hasRotatable = selectionHasRotatable();
    const hasDraftCopyTarget = selectionHasDraftCopyTarget();
    const hasFrameBackgroundMoveTarget = selectionHasFrameBackgroundMoveTarget();
    const hasFrameContentsTarget = selectionHasFrameContentsTarget();
    const hasImageTabTarget = selectionHasImageTabTarget();
    const draftBoardOnlySelection =
      hasAny && selectionItems.every((item) => item.type === "image" && isDraftBoardImage(images[item.index]));

    const isActionVisible = (action) => {
      if (!hasAny) return false;
      if (action === "apply-draft") return hasDraft;
      if (action === "move-base") return hasMoveTarget;
      if (action === "move-image") return hasMoveImageTarget;
      if (action === "move-frame-background") return hasFrameBackgroundMoveTarget;
      if (action === "add-image-tab") return hasImageTabTarget;
      if (action === "delete-frame-tab") return false;
      if (action === "select-frame-contents") return hasFrameContentsTarget;
      if (action === "rename-image") return hasImage;
      if (action === "mirror-image") return hasMirrorTarget;
      if (action === "bring-front") return hasOrderable;
      if (action === "send-back") return hasOrderable;
      if (action === "rotate-right") return hasRotatable;
      if (action === "rotate-left") return hasRotatable;
      if (action === "copy-draft") return hasDraftCopyTarget;
      if (action === "lasso-copy") return false;
      if (action === "lasso-link-board") return false;
      if (action === "lasso-draft-board") return false;
      if (action === "publish-draft-board") return false;
      if (action === "duplicate") return hasAny;
      if (action === "delete") return hasAny;
      return false;
    };

    contextMenu.querySelectorAll("button").forEach((btn) => {
      btn.classList.remove("disabled");
      const action = btn.getAttribute("data-action");
      btn.classList.toggle("hidden", !isActionVisible(action));
    });
    if (draftBoardOnlySelection) {
      contextMenu.querySelectorAll("button").forEach((btn) => btn.classList.add("hidden"));
      const publishBtn = contextMenu.querySelector('button[data-action="publish-draft-board"]');
      if (publishBtn) publishBtn.classList.remove("hidden");
      const deleteBtn = contextMenu.querySelector('button[data-action="delete"]');
      if (deleteBtn) deleteBtn.classList.remove("hidden");
      positionContextMenu(x, y);
      return;
    }
    if (!hasAny) return;

    positionContextMenu(x, y);
  }

  if (contextMenu) {
    contextMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.classList.contains("disabled")) return;
      const action = btn.getAttribute("data-action");
      if (action === "apply-draft") {
        applyDraftSelectionToPublic();
      } else if (action === "delete") {
        const draftBoard = getSelectionItems()
          .map((item) => (item.type === "image" ? images[item.index] : null))
          .find((img) => isDraftBoardImage(img));
        if (draftBoard) deleteDraftBoard(draftBoard);
        else deleteSelection();
      } else if (action === "duplicate") {
        duplicateSelectedImages();
      } else if (action === "move-base") {
        moveSelectionToBase();
      } else if (action === "move-image") {
        moveSelectionToImage();
      } else if (action === "move-frame-background") {
        moveSelectionToFrameBackground();
      } else if (action === "add-image-tab") {
        addTabToSelectedImageOrFrame();
      } else if (action === "delete-frame-tab") {
        if (contextFrameTabTarget) {
          deleteFrameTab(contextFrameTabTarget.frame, contextFrameTabTarget.tabId);
        }
      } else if (action === "select-frame-contents") {
        selectSelectedFrameContents();
      } else if (action === "rename-image") {
        setSelectedImageName();
      } else if (action === "mirror-image") {
        toggleSelectedImageMirror();
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
      } else if (action === "lasso-copy") {
        copyLassoCopySelection();
      } else if (action === "lasso-link-board") {
        createLinkedBoardFromLassoCopySelection();
      } else if (action === "lasso-draft-board") {
        createDraftBoardFromLassoCopySelection();
      } else if (action === "publish-draft-board") {
        const board = getSelectionItems()
          .map((item) => (item.type === "image" ? images[item.index] : null))
          .find((img) => isDraftBoardImage(img));
        publishDraftBoard(board);
      }
      hideContextMenu();
    });
  }

  if (frameDeleteContentsBtn) {
    frameDeleteContentsBtn.addEventListener("click", () => {
      closeFrameDeleteModal();
      deleteSelection("with-contents");
    });
  }

  if (frameDeleteFrameOnlyBtn) {
    frameDeleteFrameOnlyBtn.addEventListener("click", () => {
      closeFrameDeleteModal();
      deleteSelection("frame-only");
    });
  }

  if (frameDeleteCancelBtn) {
    frameDeleteCancelBtn.addEventListener("click", () => {
      closeFrameDeleteModal();
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
    if (framePlaceType) {
      setFooterMessage("フレーム挿入：ドラッグして同じ種類のフレームを続けて配置できます。");
      return;
    }

    if (shapeMode) {
      setFooterMessage("図形挿入：ドラッグして同じ種類の図形を続けて配置できます。");
      return;
    }

    if (linkBoardMode === "source") {
      setFooterMessage("リンクボード：元にする範囲をドラッグしてください。");
      return;
    }

    if (linkBoardMode === "place") {
      setFooterMessage("リンクボード：貼り付けたい場所をクリック、またはドラッグして大きさを指定してください。");
      return;
    }

    if (pendingTextListGridCopies) {
      setFooterMessage("複製した文字：配置したい場所をクリックしてください。");
      return;
    }

    if (pendingTextMode) {
      setFooterMessage(
        pendingTextMode === "grid"
          ? "方眼紙用入力：配置したい場所をクリックしてください。"
          : "通常入力：配置したい場所をクリックしてください。"
      );
      return;
    }

    if (lassoCopySelection) {
      setFooterMessage("投げ縄スクショ：選択範囲を右クリックして「コピー」「リンクボード作成」「下書きボード作成」を選んでください。");
      return;
    }

    if (currentTool === "lasso-copy") {
      setFooterMessage(
        `投げ縄スクショ（${lassoCopyMode === "rect" ? "四角形" : "フリーハンド"}）：範囲をドラッグしてください。`
      );
      return;
    }

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
      strokeAlphaToggleBtn.textContent = "半透明";
    }
    redraw();
    syncToolbarToActiveDraftBoard();
    showTransientFooterMessage(
      strokesDimmed ? "半透明：線と文字を薄く表示中です。" : "半透明解除：線と文字を通常の濃さで表示します。",
      4000
    );
  }

  strokeAlphaToggleBtn.addEventListener("click", () => {
    toggleStrokeAlpha();
    closeOtherMenu();
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
      if (!canCreateOnCurrentLayer()) return;
      if (!templates) templates = [];
      renderInsertMenu();
      if (insertMenu && !insertMenu.classList.contains("hidden")) {
        closeInsertMenu();
      } else {
        openInsertMenu();
      }
    });
    insertMenuBtn.addEventListener("mouseenter", () => {
      if (isCreationLockedLayer()) {
        closeInsertMenu();
        return;
      }
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
        if (isCreationLockedLayer()) {
          closeInsertMenu();
          return;
        }
        if (insertMenuHideTimer) {
          clearTimeout(insertMenuHideTimer);
          insertMenuHideTimer = null;
        }
      });
    }
  }

  function setPendingTextMode(mode) {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    if (activeLayer === "image") return;
    pendingTextListGridCopies = null;
    pendingTextMode = mode === "grid" ? "grid" : "normal";
    resetShapeMode();
    currentTool = "select";
    selected = null;
    multiSelection = null;
    if (textToolMenu) textToolMenu.classList.add("hidden");
    updateToolButtons();
    showTransientFooterMessage(
      pendingTextMode === "grid"
        ? "方眼紙用入力：配置したい場所をクリックしてください。"
        : "通常入力：配置したい場所をクリックしてください。",
      4000
    );
  }

  if (textToolBtn) {
    textToolBtn.addEventListener("mouseenter", () => {
      if (isCreationLockedLayer()) return;
      closeListMenu();
      closeOtherMenu();
      if (textToolMenu) textToolMenu.classList.remove("hidden");
    });
    textToolBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isCreationLockedLayer()) {
        showCreationLockedMessage();
        return;
      }
      setPendingTextMode("normal");
    });
  }
  if (textToolMenu) {
    textToolMenu.addEventListener("mouseenter", () => textToolMenu.classList.remove("hidden"));
    textToolMenu.addEventListener("mouseleave", () => textToolMenu.classList.add("hidden"));
    textToolMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-text-mode]");
      if (!btn) return;
      e.stopPropagation();
      if (!canCreateOnCurrentLayer()) return;
      setPendingTextMode(btn.getAttribute("data-text-mode"));
    });
  }

  if (listMenuBtn) {
    listMenuBtn.addEventListener("mouseenter", () => {
      if (textToolMenu) textToolMenu.classList.add("hidden");
      closeOtherMenu();
      openListMenu();
    });
    listMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!listMenu) return;
      if (listMenu.classList.contains("hidden")) openListMenu();
      else closeListMenu();
    });
  }
  if (listMenu) {
    listMenu.addEventListener("mouseenter", () => openListMenu());
    listMenu.addEventListener("mouseleave", () => closeListMenu());
    listMenu.addEventListener("click", () => closeListMenu());
  }

  if (watchUsersBtn && watchUsersMenu) {
    watchUsersBtn.addEventListener("mouseenter", openWatchUsersMenu);
    watchUsersMenu.addEventListener("mouseenter", openWatchUsersMenu);
    watchUsersBtn.addEventListener("mouseleave", () => setTimeout(() => {
      if (!watchUsersBtn.matches(":hover") && !watchUsersMenu.matches(":hover")) closeWatchUsersMenu();
    }, 150));
    watchUsersMenu.addEventListener("mouseleave", () => setTimeout(() => {
      if (!watchUsersBtn.matches(":hover") && !watchUsersMenu.matches(":hover")) closeWatchUsersMenu();
    }, 150));
    watchUsersBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (watchUsersMenu.classList.contains("hidden")) openWatchUsersMenu();
      else closeWatchUsersMenu();
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
    const insideList =
      listMenu &&
      listMenuBtn &&
      (listMenu.contains(target) || listMenuBtn.contains(target));
    const insideTextTool =
      textToolMenu &&
      textToolBtn &&
      (textToolMenu.contains(target) || textToolBtn.contains(target));
    const insideWatchUsers =
      watchUsersMenu &&
      watchUsersBtn &&
      (watchUsersMenu.contains(target) || watchUsersBtn.contains(target));

    if (!insideInsert) closeInsertMenu();
    if (!insideOther) closeOtherMenu();
    if (!insideList) closeListMenu();
    if (!insideWatchUsers) closeWatchUsersMenu();
    if (!insideTextTool && textToolMenu) textToolMenu.classList.add("hidden");
  });
  window.addEventListener("resize", () => {
    refreshCompactMode();
    positionTextListPanel();
    if (insertMenu && !insertMenu.classList.contains("hidden")) {
      positionInsertMenu();
    }
    applyScreenShareWindowPosition();
    positionImageListPanel();
    positionLinkListPanel();
  });
  // Undo（最後に追加したテキスト/ペン/画像を取り消し）
  undoBtn.addEventListener("click", undoLast);

  // 初期化
  if (draftBoardViewId) document.body.classList.add("draft-board-view");
  if (linkBoardView) document.body.classList.add("link-board-view");
  if (isDetachedBoardView) {
    document.body.classList.add("follow-view");
    userModal.classList.add("hidden");
    followViewLabel = document.createElement("div");
    followViewLabel.className = "follow-view-label";
    followViewLabel.textContent = `👀 ${followTargetUser} の位置を待っています`;
    if (followTargetUser) {
      followViewLabel.addEventListener("click", () => {
        if (!latestFollowView || window.parent === window) return;
        window.parent.postMessage(
          {
            type: "whiteboard:jump-to-follow-view",
            user: followTargetUser,
            view: latestFollowView,
          },
          window.location.origin
        );
      });
    }
    document.body.appendChild(followViewLabel);
  }
  updateBoardTitleDisplay();
  refreshUserDatalist();
  loadTemplates();
  updateLayerToggleUI();
  refreshCompactMode();
  updateFooterByState();
  if (!isDetachedBoardView) {
    loadBoardUsersFromServer();
    const lastUser = loadLastUser().trim();
    if (lastUser) {
      setCurrentUser(lastUser);
    } else {
      openUserModal();
    }
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
    if (!canCreateOnCurrentLayer()) return null;
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
    applyCurrentGlowColor(stroke);
    applyFrameMembershipByPoint(stroke, points[0]);
    strokes.push(stroke);
    registerUser(currentUser);
    emitStrokeAdd(stroke);
    return stroke;
  }

  function startShapeMode(kind) {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    framePlaceType = null;
    framePlaceStart = null;
    framePlacePreview = null;
    isPlacingFrame = false;
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
    updateToolButtons();
    if (kind === "grid") {
      let n = window.prompt("マス目の数 n を入力してください", "5");
      if (n === null) {
        shapeMode = null;
        updateToolButtons();
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
    if (!canCreateOnCurrentLayer()) return;
    const center = getCanvasCenterWorld();
    const name = src.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    addTemplateImage(src, center.x, center.y, getImageTargetLayer(), decodeURIComponent(name));
  }

  function chooseImageFiles() {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    if (!imageFileInput) return;
    pendingImageInsertLayer = getImageTargetLayer();
    imageFileInput.value = "";
    imageFileInput.click();
  }

  function startFramePlacement(type) {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    resetShapeMode();
    framePlaceType = type; // "omoteura" | "free"
    framePlaceStart = null;
    framePlacePreview = null;
    showTransientFooterMessage("ドラッグしてフレームの大きさを指定してください。", 4000);
    updateToolButtons();
    closeInsertMenu();
  }

  function startLinkedBoardMode() {
    if (!requireUser()) return;
    if (!canCreateOnCurrentLayer()) return;
    pendingTextListGridCopies = null;
    pendingTextMode = null;
    resetShapeMode();
    linkBoardMode = "source";
    linkBoardSourceStart = null;
    linkBoardSourcePreview = null;
    pendingLinkBoardSource = null;
    linkBoardPlaceStart = null;
    linkBoardPlacePreview = null;
    currentTool = "select";
    showTransientFooterMessage("リンクボード：元にする範囲をドラッグしてください。", 5000);
    updateToolButtons();
    closeInsertMenu();
  }

  function createLinkedBoardAt(sourceRect, _destRect, _options = {}) {
    if (!sourceRect) return false;
    const source = getNormalizedRect(sourceRect);
    if (source.width < 8 || source.height < 8) return false;
    const aspect = source.width / source.height;
    let frameWidth = Math.min(720, Math.max(360, window.innerWidth * 0.55));
    let frameHeight = frameWidth / aspect + 38;
    if (frameHeight > window.innerHeight * 0.75) {
      frameHeight = Math.max(280, window.innerHeight * 0.75);
      frameWidth = Math.max(360, (frameHeight - 38) * aspect);
    }
    const url = `${window.location.pathname}?linkBoard=${encodeURIComponent(JSON.stringify(source))}`;
    const frame = document.createElement("section");
    frame.className = "floating-app-window floating-link-board";
    frame.style.width = `${Math.round(frameWidth)}px`;
    frame.style.height = `${Math.round(frameHeight)}px`;
    const existingCount = document.querySelectorAll(".floating-link-board").length;
    frame.style.left = `${Math.min(120 + existingCount * 28, Math.max(12, window.innerWidth - frameWidth - 20))}px`;
    frame.style.top = `${Math.min(80 + existingCount * 28, Math.max(12, window.innerHeight - frameHeight - 20))}px`;

    const header = document.createElement("header");
    header.className = "floating-link-board-header";
    const title = document.createElement("span");
    title.textContent = "リンクボード";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "floating-link-board-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "リンクボードを閉じる");
    header.appendChild(title);
    header.appendChild(closeButton);

    const iframe = document.createElement("iframe");
    iframe.className = "floating-link-board-content";
    iframe.src = url;
    iframe.title = "リンクボード";
    frame.appendChild(header);
    frame.appendChild(iframe);
    document.body.appendChild(frame);
    iframe.addEventListener("load", syncToolbarToActiveDraftBoard);

    const activate = () => {
      activateFloatingAppWindow(frame);
    };
    frame.addEventListener("pointerdown", activate);
    activate();

    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = frame.getBoundingClientRect();
      drag = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      header.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const minLeft = Math.min(0, 80 - frame.offsetWidth);
      const maxLeft = Math.max(minLeft, window.innerWidth - 80);
      const maxTop = Math.max(0, window.innerHeight - 38);
      frame.style.left = `${Math.min(Math.max(minLeft, event.clientX - drag.dx), maxLeft)}px`;
      frame.style.top = `${Math.min(Math.max(0, event.clientY - drag.dy), maxTop)}px`;
      frame.style.right = "auto";
      frame.style.bottom = "auto";
    });
    const endDrag = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      header.releasePointerCapture?.(event.pointerId);
      drag = null;
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
    closeButton.addEventListener("click", () => {
      const wasActive = frame.classList.contains("active");
      frame.remove();
      if (wasActive) activateTopFloatingAppWindow();
    });
    multiSelection = null;
    selected = null;
    linkBoardMode = null;
    pendingLinkBoardSource = null;
    linkBoardPlaceStart = null;
    linkBoardPlacePreview = null;
    updateFooterByState();
    redraw();
    showTransientFooterMessage("リンクボードをアプリ内の別窓で開きました。", 2500);
    return true;
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
    if (isCreationLockedLayer()) {
      closeInsertMenu();
      return;
    }
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
    let viewportBottom = window.innerHeight - margin;
    if (footerHint) {
      const footerRect = footerHint.getBoundingClientRect();
      if (footerRect.height > 0) {
        viewportBottom = Math.min(viewportBottom, footerRect.top - margin);
      }
    }
    viewportBottom = Math.max(margin + 80, viewportBottom);
    const viewportMaxHeight = Math.max(80, viewportBottom - margin);
    const minMenuHeight = Math.min(120, viewportMaxHeight);

    const btnRect = insertMenuBtn.getBoundingClientRect();

    insertMenu.style.left = "0px";
    insertMenu.style.top = "0px";
    insertMenu.style.bottom = "auto";
    insertMenu.style.maxHeight = `${viewportMaxHeight}px`;

    const naturalRect = insertMenu.getBoundingClientRect();

    const availableBelow = Math.max(0, viewportBottom - btnRect.bottom - margin);
    const availableAbove = Math.max(0, btnRect.top - margin);
    const openUpwards = naturalRect.height > availableBelow && availableAbove > availableBelow;
    const availableHeight = openUpwards ? availableAbove : availableBelow;
    const maxHeight = Math.min(
      viewportMaxHeight,
      Math.max(minMenuHeight, availableHeight)
    );
    insertMenu.style.maxHeight = `${maxHeight}px`;

    let top;
    if (openUpwards) {
      top = btnRect.top - Math.min(naturalRect.height, maxHeight) - margin;
    } else {
      top = btnRect.bottom + margin;
    }

    const menuRect = insertMenu.getBoundingClientRect();
    const menuHeight = Math.min(menuRect.height, maxHeight);
    top = Math.min(
      Math.max(margin, top),
      Math.max(margin, viewportBottom - menuHeight)
    );

    let left = btnRect.left;
    const maxLeft = Math.max(margin, window.innerWidth - menuRect.width - margin);
    left = Math.min(Math.max(margin, left), maxLeft);

    insertMenu.style.left = `${left}px`;
    insertMenu.style.top = `${top}px`;
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
    framePlaceType = null;
    framePlaceStart = null;
    framePlacePreview = null;
    isPlacingFrame = false;
    linkBoardMode = null;
    linkBoardSourceStart = null;
    linkBoardSourcePreview = null;
    pendingLinkBoardSource = null;
    linkBoardPlaceStart = null;
    linkBoardPlacePreview = null;
    updateToolButtons();
  }

  // --- ここまで ---
})();
