(() => {
  const designPathMatch = window.location.pathname.match(/\/d\/([^/]+)/);
  const APP_BASE_PATH = designPathMatch ? window.location.pathname.replace(/\/d\/[^/]+\/?$/, "") : "";
  const boardId = decodeURIComponent(designPathMatch?.[1] || "preview");
  const appUrl = (path) => `${APP_BASE_PATH}/${String(path).replace(/^\/+/, "")}`;

  function createLocalSocket() {
    const handlers = new Map();
    const api = {
      on(name, fn) { const list = handlers.get(name) || []; list.push(fn); handlers.set(name, list); return api; },
      emit(_name, payload, ack) { if (typeof ack === "function") ack({ ok: true, item: payload?.item }); return api; },
    };
    queueMicrotask(() => (handlers.get("connect") || []).forEach((fn) => fn()));
    return api;
  }

  const socket = typeof io === "function" ? io({ path: `${APP_BASE_PATH}/socket.io` }) : createLocalSocket();
  const canvas = document.getElementById("design-canvas");
  const canvasStage = document.getElementById("canvas-stage");
  const viewport = document.getElementById("canvas-viewport");
  const zoomStatus = document.getElementById("zoom-status");
  const transitionLayer = document.getElementById("transition-layer");
  const emptyState = document.getElementById("empty-state");
  const inspectorEmpty = document.getElementById("inspector-empty");
  const inspectorForm = document.getElementById("inspector-form");
  const nameFieldLabel = document.getElementById("name-field-label");
  const descriptionFieldLabel = document.getElementById("description-field-label");
  const saveState = document.getElementById("save-state");
  const toolHelp = document.getElementById("tool-help");
  const transitionTool = document.getElementById("transition-tool");
  const userModal = document.getElementById("user-modal");
  const userForm = document.getElementById("user-form");
  const userNameInput = document.getElementById("user-name");
  const items = new Map();
  let selectedId = null;
  let currentUser = "";
  let saveTimer = null;
  let transitionSourceId = null;
  let placementTool = null;
  let placementPreview = null;
  let suppressCanvasClick = false;
  let suppressPanContextMenu = false;
  const canvasSizeKey = `screen-design-canvas-size:${boardId}`;
  let storedCanvasSize = {};
  try { storedCanvasSize = JSON.parse(localStorage.getItem(canvasSizeKey) || "{}"); } catch (_error) { storedCanvasSize = {}; }
  let canvasWidth = Math.max(3200, Number(storedCanvasSize.width) || 0);
  let canvasHeight = Math.max(2000, Number(storedCanvasSize.height) || 0);
  let zoom = Math.min(2.5, Math.max(0.25, Number(localStorage.getItem("screen-design-zoom")) || 1));

  document.getElementById("back-to-list").href = appUrl("d/");
  document.getElementById("export-json").href = appUrl(`api/boards/${encodeURIComponent(boardId)}/design-spec`);
  document.getElementById("export-md").href = appUrl(`api/boards/${encodeURIComponent(boardId)}/design-spec.md`);
  document.getElementById("export-preview").href = appUrl(`api/boards/${encodeURIComponent(boardId)}/design-preview.html`);
  userNameInput.value = localStorage.getItem("screen-design-user") || "";

  const fields = {
    kind: document.getElementById("item-kind"), heading: document.getElementById("item-heading"),
    name: document.getElementById("field-name"), textContent: document.getElementById("field-text-content"),
    description: document.getElementById("field-description"), behavior: document.getElementById("field-behavior"), memo: document.getElementById("field-memo"),
    color: document.getElementById("field-color"),
    linkScreen: document.getElementById("field-link-screen"), linkNote: document.getElementById("field-link-note"),
    menuDirection: document.getElementById("field-menu-direction"),
    trigger: document.getElementById("field-trigger"), condition: document.getElementById("field-condition"),
    options: document.getElementById("field-options"), resolution: document.getElementById("field-resolution"),
    relatedItem: document.getElementById("field-related-item"),
    noteRelatedItem: document.getElementById("field-note-related-item"),
    decided: document.getElementById("field-decided"),
    done: document.getElementById("field-done"),
  };
  const imageInput = document.getElementById("field-image");
  const resetColorButton = document.getElementById("reset-color");
  const copyLayoutButton = document.getElementById("copy-layout-all");
  const contextMenu = document.getElementById("object-context-menu");
  const contextDuplicate = document.getElementById("context-duplicate");
  const contextDelete = document.getElementById("context-delete");
  const relatedDecisionsPanel = document.getElementById("related-decisions-panel");
  const relatedDecisionsCount = document.getElementById("related-decisions-count");
  const relatedDecisionsList = document.getElementById("related-decisions-list");
  const inspectorAddDecision = document.getElementById("inspector-add-decision");
  const relatedNotesPanel = document.getElementById("related-notes-panel");
  const relatedNotesCount = document.getElementById("related-notes-count");
  const relatedNotesList = document.getElementById("related-notes-list");
  const inspectorAddNote = document.getElementById("inspector-add-note");
  const menuFields = document.getElementById("menu-fields");
  const menuItemsEditor = document.getElementById("menu-items-editor");
  const addMenuItemButton = document.getElementById("add-menu-item");
  const recentColorsElement = document.getElementById("recent-colors");
  const recentColorSwatches = document.getElementById("recent-color-swatches");
  const recentColorsKey = "screen-design-recent-colors";
  let recentColors = [];
  let focusedDecisionId = null;
  let focusedNoteId = null;
  try {
    recentColors = JSON.parse(localStorage.getItem(recentColorsKey) || "[]").filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 8);
  } catch (_error) {
    recentColors = [];
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const kindLabel = { screen: "画面", component: "UI部品", transition: "画面遷移", note: "メモ", decision: "案" };
  const componentLabel = { button: "ボタン", input: "入力欄", dropdown: "ドロップダウン", text: "テキスト", list: "一覧", image: "画像", box: "四角", header: "ヘッダー", footer: "フッター", sidebar: "サイドバー（左）", "sidebar-left": "サイドバー（左）", "sidebar-right": "サイドバー（右）", menu: "メニュー" };
  const componentDefaultColor = { button: "#344054", input: "#ffffff", dropdown: "#ffffff", text: "#ffffff", list: "#ffffff", image: "#eef2f7", box: "#ffffff", header: "#dbe4f0", footer: "#dbe4f0", sidebar: "#e7ebf2", "sidebar-left": "#e7ebf2", "sidebar-right": "#e7ebf2", menu: "#f8fafc" };
  const layoutTypes = new Set(["header", "footer", "sidebar", "sidebar-left", "sidebar-right"]);
  const canonicalLayoutType = (type) => type === "sidebar" ? "sidebar-left" : type;

  function itemDisplayName(item) {
    if (!item) return "削除された対象";
    if (item.kind === "screen") return item.data?.name || "名称未設定の画面";
    if (item.kind === "component") return item.data?.name || componentLabel[item.data?.componentType] || "UI部品";
    return item.data?.title || item.data?.question || kindLabel[item.kind] || "対象";
  }

  function defaultMenuItems() {
    return ["メニュー項目 1", "メニュー項目 2", "メニュー項目 3"].map((label) => ({ id: uid(), label, linkScreenId: null, note: "" }));
  }

  function menuDirectionFor(item) {
    const requested = item.data?.menuDirection || "auto";
    if (requested === "horizontal" || requested === "vertical") return requested;
    const count = Math.max(1, Array.isArray(item.data?.menuItems) ? item.data.menuItems.length : 1);
    return item.width >= item.height * 1.35 && item.width / count >= 72 ? "horizontal" : "vertical";
  }

  function normalize(item) {
    return { x: 0, y: 0, width: 240, height: 140, zIndex: 0, data: {}, ...item, data: { ...(item.data || {}) } };
  }

  function nextZ(kind) {
    return Math.min(99999, 1 + Math.max(0, ...[...items.values()].filter((item) => item.kind === kind).map((item) => Number(item.zIndex) || 0)));
  }

  function visualZ(item) {
    const base = item.kind === "screen" ? 10 : item.kind === "component" ? 30 : 40;
    return base + Math.min(9, Math.max(0, Number(item.zIndex) || 0) % 10);
  }

  function applyZoom(nextZoom = zoom) {
    zoom = Math.min(2.5, Math.max(0.25, nextZoom));
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.setProperty("--inverse-zoom", String(1 / zoom));
    canvas.style.transform = `scale(${zoom})`;
    canvasStage.style.width = `${canvasWidth * zoom}px`;
    canvasStage.style.height = `${canvasHeight * zoom}px`;
    transitionLayer.setAttribute("width", canvasWidth);
    transitionLayer.setAttribute("height", canvasHeight);
    zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
    try { localStorage.setItem("screen-design-zoom", String(zoom)); } catch (_error) { /* storage unavailable */ }
  }

  function setCanvasSize(width, height) {
    canvasWidth = Math.max(3200, Math.ceil(width / 400) * 400);
    canvasHeight = Math.max(2000, Math.ceil(height / 400) * 400);
    try { localStorage.setItem(canvasSizeKey, JSON.stringify({ width: canvasWidth, height: canvasHeight })); } catch (_error) { /* storage unavailable */ }
    applyZoom();
  }

  function expandCanvasToFitItems() {
    let requiredWidth = 3200;
    let requiredHeight = 2000;
    items.forEach((item) => {
      if (item.kind === "transition") return;
      requiredWidth = Math.max(requiredWidth, item.x + item.width + 600);
      requiredHeight = Math.max(requiredHeight, item.y + item.height + 500);
      const positions = item.data?.calloutPositions;
      if (positions && typeof positions === "object") {
        Object.values(positions).forEach((position) => {
          if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
          requiredWidth = Math.max(requiredWidth, item.x + position.x + 300);
          requiredHeight = Math.max(requiredHeight, item.y + position.y + 160);
        });
      }
    });
    if (requiredWidth > canvasWidth || requiredHeight > canvasHeight) setCanvasSize(Math.max(requiredWidth, canvasWidth), Math.max(requiredHeight, canvasHeight));
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  }

  applyZoom();

  function snap(value) { return Math.round(value / 8) * 8; }

  function attachToScreen(item, screen) {
    if (!item || !screen || item.kind !== "component" || !layoutTypes.has(item.data?.componentType)) return false;
    const before = `${item.x}:${item.y}:${item.width}:${item.height}:${item.data.screenId || ""}`;
    const type = canonicalLayoutType(item.data.componentType);
    item.data.screenId = screen.id;
    if (["header", "footer"].includes(type)) {
      item.x = screen.x + 2;
      item.width = Math.max(80, screen.width - 4);
      item.y = type === "header" ? screen.y + 50 : screen.y + screen.height - item.height - 2;
    } else {
      const header = [...items.values()].find((candidate) => candidate.id !== item.id && candidate.kind === "component" && candidate.data?.screenId === screen.id && canonicalLayoutType(candidate.data?.componentType) === "header");
      const footer = [...items.values()].find((candidate) => candidate.id !== item.id && candidate.kind === "component" && candidate.data?.screenId === screen.id && canonicalLayoutType(candidate.data?.componentType) === "footer");
      const top = header ? header.y + header.height : screen.y + 50;
      const bottom = footer ? footer.y : screen.y + screen.height - 2;
      item.y = top;
      item.height = Math.max(40, bottom - top);
      item.x = type === "sidebar-right" ? screen.x + screen.width - item.width - 2 : screen.x + 2;
    }
    return before !== `${item.x}:${item.y}:${item.width}:${item.height}:${item.data.screenId || ""}`;
  }

  function screenLayouts(screenId) {
    return [...items.values()].filter((item) => item.kind === "component" && item.data?.screenId === screenId && layoutTypes.has(item.data?.componentType));
  }

  function refreshScreenLayouts(screen) {
    if (!screen) return [];
    const layouts = screenLayouts(screen.id);
    layouts.filter((item) => ["header", "footer"].includes(canonicalLayoutType(item.data.componentType))).forEach((item) => attachToScreen(item, screen));
    layouts.filter((item) => canonicalLayoutType(item.data.componentType).startsWith("sidebar-")).forEach((item) => attachToScreen(item, screen));
    return layouts;
  }

  function colorTextFor(background) {
    const match = String(background || "").match(/^#([0-9a-f]{6})$/i);
    if (!match) return "#172033";
    const value = Number.parseInt(match[1], 16);
    const luminance = ((value >> 16) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;
    return luminance < 145 ? "#ffffff" : "#172033";
  }

  function renderRecentColors() {
    recentColorsElement.classList.toggle("hidden", recentColors.length === 0);
    recentColorSwatches.innerHTML = "";
    recentColors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "recent-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `背景色 ${color} を適用`);
      swatch.addEventListener("click", () => {
        const item = items.get(selectedId);
        if (!item || item.kind !== "component") return;
        fields.color.value = color;
        item.data.color = color;
        rememberRecentColor(color);
        saveItem(item, true);
        renderAll();
      });
      recentColorSwatches.appendChild(swatch);
    });
  }

  function rememberRecentColor(color) {
    const normalized = String(color || "").toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
    recentColors = [normalized, ...recentColors.filter((value) => value.toLowerCase() !== normalized)].slice(0, 8);
    try { localStorage.setItem(recentColorsKey, JSON.stringify(recentColors)); } catch (_error) { /* storage unavailable */ }
    renderRecentColors();
  }

  function hideContextMenu() { contextMenu.classList.add("hidden"); }

  function showContextMenu(event, item) {
    if (!userModal.classList.contains("hidden")) return;
    event.preventDefault();
    event.stopPropagation();
    selectItem(item.id);
    const unsupported = item.kind === "transition" || (item.kind === "component" && layoutTypes.has(item.data?.componentType));
    contextDuplicate.disabled = unsupported;
    contextDuplicate.title = unsupported ? "レイアウトと画面遷移は複製できません" : "";
    contextMenu.classList.remove("hidden");
    const width = 190;
    const height = contextMenu.offsetHeight || 90;
    contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))}px`;
  }

  function independentCopyData(data) {
    const copied = copyData(data);
    if (Array.isArray(copied.menuItems)) copied.menuItems = copied.menuItems.map((menuItem) => ({ ...menuItem, id: uid() }));
    delete copied.globalLayoutId;
    delete copied.applyToNewScreens;
    delete copied.templateChildren;
    delete copied.globalParentLayoutId;
    delete copied.globalTemplateChildId;
    return copied;
  }

  function duplicateSelected() {
    hideContextMenu();
    if (!userModal.classList.contains("hidden")) return;
    const original = items.get(selectedId);
    if (!original) return;
    if (original.kind === "transition" || (original.kind === "component" && layoutTypes.has(original.data?.componentType))) {
      toolHelp.textContent = "レイアウトは全画面コピー、画面遷移は遷移ツールを使ってください。";
      return;
    }
    const offset = 24;
    if (original.kind === "screen") {
      const screenCopy = normalize({
        ...original, id: uid(), x: original.x + offset, y: original.y + offset, zIndex: nextZ("screen"),
        createdBy: currentUser, createdAt: Date.now(), data: { ...independentCopyData(original.data), name: `${original.data?.name || "画面"} コピー` },
      });
      items.set(screenCopy.id, screenCopy);
      const copies = [screenCopy];
      const children = [...items.values()].filter((item) => item.id !== screenCopy.id && item.kind !== "screen" && item.kind !== "transition" && item.data?.screenId === original.id);
      const childIdMap = new Map(children.map((child) => [child.id, uid()]));
      children.forEach((child) => {
        const data = independentCopyData(child.data);
        data.screenId = screenCopy.id;
        if (data.linkScreenId === original.id) data.linkScreenId = screenCopy.id;
        if (data.relatedItemId === original.id) data.relatedItemId = screenCopy.id;
        else if (childIdMap.has(data.relatedItemId)) data.relatedItemId = childIdMap.get(data.relatedItemId);
        if (Array.isArray(data.menuItems)) {
          data.menuItems.forEach((menuItem) => {
            if (menuItem.linkScreenId === original.id) menuItem.linkScreenId = screenCopy.id;
          });
        }
        const childCopy = normalize({
          ...child, id: childIdMap.get(child.id), x: child.x + offset, y: child.y + offset, zIndex: nextZ(child.kind),
          createdBy: currentUser, createdAt: Date.now(), data,
        });
        items.set(childCopy.id, childCopy);
        copies.push(childCopy);
      });
      refreshScreenLayouts(screenCopy);
      saveMany(copies);
      selectedId = screenCopy.id;
      toolHelp.textContent = "画面とその中のオブジェクトを複製しました。";
    } else {
      const data = independentCopyData(original.data);
      if (original.kind === "component" && data.name) data.name = `${data.name} コピー`;
      if (original.kind === "note" && data.title) data.title = `${data.title} コピー`;
      if (original.kind === "decision" && data.question) data.question = `${data.question} コピー`;
      const copy = normalize({
        ...original, id: uid(), x: original.x + offset, y: original.y + offset, zIndex: nextZ(original.kind),
        createdBy: currentUser, createdAt: Date.now(), data,
      });
      items.set(copy.id, copy);
      saveItem(copy, true);
      selectedId = copy.id;
      toolHelp.textContent = "オブジェクトを複製しました。";
    }
    renderAll();
    renderInspector();
  }

  function saveItem(item, immediate = false) {
    items.set(item.id, item);
    saveState.textContent = "保存中…";
    const send = () => socket.emit("design:item:save", { boardId, item }, (result) => {
      if (!result?.ok && result?.duplicateTransitionId) {
        items.delete(item.id);
        selectedId = items.has(result.duplicateTransitionId) ? result.duplicateTransitionId : null;
        toolHelp.textContent = "同じ向きの画面遷移が同時に作成されたため、重複分を取り消しました。";
        renderAll();
        renderInspector();
      }
      saveState.textContent = result?.ok ? "保存済み" : "保存できませんでした";
    });
    if (immediate) send();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(send, 260); }
  }

  function saveMany(changedItems) {
    changedItems.forEach((item) => saveItem(item, true));
  }

  function screenCount() { return [...items.values()].filter((item) => item.kind === "screen").length; }

  function recoverInvisibleScreens() {
    const changed = [];
    [...items.values()].filter((item) => item.kind === "screen").forEach((screen) => {
      const dx = screen.x < 0 ? 16 - screen.x : 0;
      const dy = screen.y < 0 ? 16 - screen.y : 0;
      if (!dx && !dy) return;
      screen.x += dx;
      screen.y += dy;
      changed.push(screen);
      [...items.values()].filter((candidate) => candidate.data?.screenId === screen.id).forEach((child) => {
        child.x += dx;
        child.y += dy;
        changed.push(child);
      });
    });
    return changed;
  }

  function findContainingScreen(x, y, excludedId = null) {
    return [...items.values()]
      .filter((item) => item.kind === "screen" && item.id !== excludedId && x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] || null;
  }

  function getSelectedScreenId() {
    const selected = items.get(selectedId);
    if (selected?.kind === "screen") return selected.id;
    return selected?.data?.screenId || null;
  }

  function activatePlacement(kind, componentType = null, button = null) {
    placementTool = { kind, componentType };
    transitionSourceId = null;
    document.querySelectorAll(".palette button").forEach((item) => item.classList.remove("active"));
    button?.classList.add("active");
    viewport.classList.add("placing");
    toolHelp.textContent = `${kind === "component" ? componentLabel[componentType] : kindLabel[kind]}を置く範囲をドラッグしてください。`;
  }

  function cancelPlacement(message = "配置を中止しました。") {
    placementTool = null;
    placementPreview?.remove();
    placementPreview = null;
    viewport.classList.remove("placing");
    document.querySelectorAll(".palette button").forEach((item) => item.classList.remove("active"));
    toolHelp.textContent = message;
  }

  function itemFromBounds(tool, bounds) {
    const kind = tool.kind;
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const parent = kind === "screen" ? null : findContainingScreen(center.x, center.y);
    const base = {
      id: uid(), kind, ...bounds, zIndex: nextZ(kind), createdBy: currentUser, createdAt: Date.now(),
    };
    if (kind === "screen") return normalize({ ...base, data: { name: `画面 ${screenCount() + 1}`, description: "" } });
    if (kind === "component") {
      const item = normalize({ ...base, data: { name: componentLabel[tool.componentType] || "UI部品", componentType: tool.componentType || "button", screenId: parent?.id || null, behavior: "", memo: "", ...(tool.componentType === "text" ? { textContent: "ここにテキストが入ります" } : {}), ...(tool.componentType === "menu" ? { menuItems: defaultMenuItems(), menuDirection: "auto" } : {}) } });
      if (parent) attachToScreen(item, parent);
      return item;
    }
    if (kind === "note") return normalize({ ...base, data: { title: "メモ", body: "ここに補足を書きます。", relatedItemId: null, screenId: parent?.id || null } });
    return normalize({ ...base, data: { question: "案", options: ["案A", "案B"], resolution: "", relatedItemId: null, screenId: parent?.id || null, status: "open", done: false } });
  }

  function createDecisionForTarget(target) {
    if (!target || target.kind === "transition" || target.kind === "decision") return;
    const width = 240;
    const height = 140;
    let x = target.x + target.width + 64;
    if (x + width > canvasWidth - 32) x = Math.max(16, target.x - width - 64);
    const item = normalize({
      id: uid(), kind: "decision", x, y: Math.max(16, target.y), width, height,
      zIndex: nextZ("decision"), createdBy: currentUser, createdAt: Date.now(),
      data: {
        question: `${itemDisplayName(target)}に関する案`, options: ["案A", "案B"], resolution: "",
        relatedItemId: target.id, screenId: target.kind === "screen" ? target.id : target.data?.screenId || null, status: "open", done: false,
      },
    });
    items.set(item.id, item);
    saveItem(item, true);
    selectedId = target.id;
    renderAll();
    renderInspector();
    toolHelp.textContent = `「${itemDisplayName(target)}」に関連する案を追加しました。`;
  }

  function createNoteForTarget(target) {
    if (!target || target.kind === "transition" || target.kind === "note") return;
    const width = 220;
    const height = 120;
    let x = target.x + target.width + 64;
    if (x + width > canvasWidth - 32) x = Math.max(16, target.x - width - 64);
    const item = normalize({
      id: uid(), kind: "note", x, y: Math.max(16, target.y), width, height,
      zIndex: nextZ("note"), createdBy: currentUser, createdAt: Date.now(),
      data: {
        title: `${itemDisplayName(target)}に関するメモ`, body: "ここに補足を書きます。",
        relatedItemId: target.id, screenId: target.kind === "screen" ? target.id : target.data?.screenId || null,
      },
    });
    items.set(item.id, item);
    saveItem(item, true);
    selectedId = target.id;
    renderAll();
    renderInspector();
    toolHelp.textContent = `「${itemDisplayName(target)}」に関連するメモを追加しました。`;
  }

  function createAttachedComponent(componentType) {
    const screens = [...items.values()].filter((item) => item.kind === "screen");
    const selectedScreen = items.get(getSelectedScreenId());
    const screen = selectedScreen?.kind === "screen" ? selectedScreen : screens.length === 1 ? screens[0] : null;
    if (!screen) {
      cancelPlacement("先に追加先の画面を選択してください。");
      return;
    }
    const role = canonicalLayoutType(componentType);
    const existing = [...items.values()].find((item) => item.kind === "component" && item.data?.screenId === screen.id && canonicalLayoutType(item.data?.componentType) === role);
    if (existing) {
      cancelPlacement(`${componentLabel[componentType]}はこの画面にすでにあります。`);
      selectItem(existing.id);
      return;
    }
    const isSidebar = role.startsWith("sidebar-");
    const item = normalize({
      id: uid(), kind: "component", x: screen.x + 2, y: screen.y + 50, width: isSidebar ? Math.min(160, Math.max(80, screen.width / 3)) : screen.width - 4, height: isSidebar ? screen.height - 52 : 40,
      zIndex: nextZ("component"), createdBy: currentUser, createdAt: Date.now(),
      data: { name: componentLabel[componentType], componentType, screenId: screen.id, behavior: "", memo: "" },
    });
    items.set(item.id, item);
    refreshScreenLayouts(screen);
    saveMany(screenLayouts(screen.id));
    cancelPlacement(`${componentLabel[componentType]}を画面に追加しました。高さは右下のハンドルで変更できます。`);
    selectItem(item.id);
  }

  function copyData(data) { return JSON.parse(JSON.stringify(data || {})); }

  function copyLayoutToAllScreens(source) {
    if (!source || source.kind !== "component" || !layoutTypes.has(source.data?.componentType)) return;
    const role = canonicalLayoutType(source.data.componentType);
    const globalLayoutId = source.data.globalLayoutId || uid();
    const screens = [...items.values()].filter((item) => item.kind === "screen");
    screens.forEach((screen) => {
      let layout = [...items.values()].find((item) => item.kind === "component" && item.data?.screenId === screen.id && canonicalLayoutType(item.data?.componentType) === role);
      if (!layout) {
        layout = normalize({
          id: uid(), kind: "component", x: source.x, y: source.y, width: source.width, height: source.height,
          zIndex: nextZ("component"), createdBy: currentUser, createdAt: Date.now(), data: copyData(source.data),
        });
        layout.data.screenId = screen.id;
        items.set(layout.id, layout);
      }
      if (layout.id !== source.id) {
        layout.width = source.width;
        layout.height = source.height;
        layout.data = { ...copyData(source.data), screenId: screen.id };
      }
      layout.data.globalLayoutId = globalLayoutId;
      layout.data.applyToNewScreens = true;
      delete layout.data.templateChildren;
      refreshScreenLayouts(screen);
      saveMany(screenLayouts(screen.id));
    });
    source.data.globalLayoutId = globalLayoutId;
    source.data.applyToNewScreens = true;
    delete source.data.templateChildren;
    saveItem(source, true);
    renderAll();
    renderInspector();
    toolHelp.textContent = `${componentLabel[source.data.componentType]}本体を全画面にコピーしました。`;
  }

  function applyGlobalLayoutsToScreen(screen) {
    const templates = new Map();
    [...items.values()].filter((item) => item.kind === "component" && layoutTypes.has(item.data?.componentType) && item.data?.applyToNewScreens && item.data?.globalLayoutId)
      .forEach((item) => { if (!templates.has(item.data.globalLayoutId)) templates.set(item.data.globalLayoutId, item); });
    templates.forEach((template) => {
      const role = canonicalLayoutType(template.data.componentType);
      if ([...items.values()].some((item) => item.kind === "component" && item.data?.screenId === screen.id && canonicalLayoutType(item.data?.componentType) === role)) return;
      const layout = normalize({
        id: uid(), kind: "component", x: screen.x, y: screen.y, width: template.width, height: template.height,
        zIndex: nextZ("component"), createdBy: currentUser, createdAt: Date.now(), data: copyData(template.data),
      });
      layout.data.screenId = screen.id;
      delete layout.data.templateChildren;
      items.set(layout.id, layout);
    });
    refreshScreenLayouts(screen);
    saveMany(screenLayouts(screen.id));
  }

  function beginPlacement(event) {
    if (!placementTool || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = canvasPoint(event);
    placementPreview = document.createElement("div");
    placementPreview.className = "placement-preview";
    canvas.appendChild(placementPreview);

    const move = (moveEvent) => {
      const point = canvasPoint(moveEvent);
      const x = snap(Math.min(start.x, point.x));
      const y = snap(Math.min(start.y, point.y));
      const width = Math.max(8, snap(Math.abs(point.x - start.x)));
      const height = Math.max(8, snap(Math.abs(point.y - start.y)));
      placementPreview.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px`;
    };
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const point = canvasPoint(upEvent);
      const minSize = placementTool.kind === "screen" ? { w: 160, h: 180 } : placementTool.kind === "component" ? { w: 80, h: 28 } : { w: 120, h: 80 };
      const bounds = {
        x: snap(Math.min(start.x, point.x)), y: snap(Math.min(start.y, point.y)),
        width: Math.max(minSize.w, snap(Math.abs(point.x - start.x))),
        height: Math.max(minSize.h, snap(Math.abs(point.y - start.y))),
      };
      const item = itemFromBounds(placementTool, bounds);
      suppressCanvasClick = true;
      items.set(item.id, item);
      saveItem(item, true);
      if (item.kind === "screen") applyGlobalLayoutsToScreen(item);
      cancelPlacement("配置しました。選択すると右下のハンドルで大きさを変更できます。");
      selectItem(item.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function renderAll() {
    expandCanvasToFitItems();
    canvas.querySelectorAll(".design-item,.transition-label,.behavior-callout,.link-label,.screen-resize-handle").forEach((element) => element.remove());
    transitionLayer.querySelectorAll("line").forEach((element) => element.remove());
    [...items.values()].filter((item) => item.kind !== "transition" && !(item.kind === "decision" && item.data?.done)).sort((a, b) => visualZ(a) - visualZ(b)).forEach(renderItem);
    [...items.values()].filter((item) => item.kind === "transition").forEach(renderTransition);
    [...items.values()].filter((item) => (item.kind === "decision" || item.kind === "note") && item.data?.relatedItemId && !(item.kind === "decision" && item.data?.done)).forEach(renderObjectRelation);
    [...items.values()].filter((item) => item.kind === "component" && item.data?.linkScreenId).forEach(renderComponentLink);
    [...items.values()].filter((item) => item.kind === "screen" && String(item.data?.description || "").trim()).forEach(renderScreenDescriptionCallout);
    [...items.values()].filter((item) => item.kind === "component" && (String(item.data?.behavior || "").trim() || String(item.data?.memo || "").trim())).forEach(renderComponentCallouts);
    emptyState.classList.toggle("hidden", items.size > 0);
  }

  function renderItem(item) {
    const element = document.createElement("article");
    element.className = `design-item ${item.kind}${item.id === selectedId ? " selected" : ""}`;
    element.dataset.id = item.id;
    element.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;z-index:${visualZ(item)}`;
    if (item.kind === "screen") {
      element.innerHTML = `<div class="screen-header"><strong>${escapeHtml(item.data.name || "名称未設定")}</strong></div><div class="screen-body"></div>`;
    } else if (item.kind === "component") {
      element.dataset.type = item.data.componentType || "button";
      if (item.data.color) {
        element.style.backgroundColor = item.data.color;
        element.style.color = colorTextFor(item.data.color);
      }
      if (item.data.componentType === "menu") {
        element.classList.add(`menu-${menuDirectionFor(item)}`);
        const menuItems = Array.isArray(item.data.menuItems) ? item.data.menuItems : [];
        menuItems.forEach((menuItem) => { if (!menuItem.id) menuItem.id = uid(); });
        const entries = menuItems.map((menuItem) => {
          const target = items.get(menuItem.linkScreenId);
          const targetText = target?.kind === "screen" ? `→ ${target.data?.name || "リンク先画面"}` : "リンク未設定";
          const note = String(menuItem.note || "").trim();
          const removeButton = item.id === selectedId ? `<button type="button" class="menu-preview-remove" data-menu-item-remove="${escapeHtml(menuItem.id)}" title="この項目を削除" aria-label="${escapeHtml(menuItem.label || "メニュー項目")}を削除">×</button>` : "";
          return `<span class="menu-preview-item">${removeButton}<b>${escapeHtml(menuItem.label || "名称未設定")}</b><small>${escapeHtml(targetText)}</small>${note ? `<em>${escapeHtml(note)}</em>` : ""}</span>`;
        }).join("");
        element.innerHTML = `<strong class="menu-title">${escapeHtml(item.data.name || "メニュー")}</strong><span class="menu-preview">${entries || '<span class="menu-preview-empty">項目を追加してください</span>'}</span>`;
        element.querySelectorAll("[data-menu-item-remove]").forEach((button) => {
          button.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); });
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeMenuItem(item, button.dataset.menuItemRemove);
          });
        });
      } else {
        element.innerHTML = item.data.componentType === "image" && item.data.imageSrc
          ? `<img src="${escapeHtml(item.data.imageSrc)}" alt="${escapeHtml(item.data.name || "画像")}" draggable="false" />`
          : `<span>${escapeHtml(item.data.componentType === "text" ? (item.data.textContent ?? "ここにテキストが入ります") : (item.data.name || componentLabel[item.data.componentType] || "UI部品"))}</span>`;
      }
      if (item.data.componentType === "text") element.title = item.data.name || "テキスト";
    } else if (item.kind === "note") {
      element.innerHTML = `<strong>✎ ${escapeHtml(item.data.title || "メモ")}</strong><p>${escapeHtml(item.data.body || "")}</p>`;
    } else if (item.kind === "decision") {
      const decided = item.data.status === "decided";
      if (decided) element.classList.add("decided");
      const detail = decided
        ? `<p class="decision-resolution"><b>決定事項</b>${escapeHtml(item.data.resolution || "未入力")}</p>`
        : `<p>${escapeHtml((item.data.options || []).filter(Boolean).join(" / "))}</p>`;
      element.innerHTML = `<strong>${escapeHtml(item.data.question || "案")}</strong>${detail}`;
    }
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (suppressCanvasClick) { suppressCanvasClick = false; return; }
      if (transitionSourceId && item.kind === "screen") return finishTransition(item.id);
      selectItem(item.id);
    });
    element.addEventListener("contextmenu", (event) => showContextMenu(event, item));
    const dragTarget = item.kind === "screen" ? element.querySelector(".screen-header") : element;
    dragTarget.addEventListener("pointerdown", (event) => beginDrag(event, item));
    if (item.id === selectedId) {
      const resizeHandle = document.createElement("button");
      resizeHandle.type = "button";
      resizeHandle.className = "resize-handle";
      resizeHandle.title = "ドラッグしてサイズ変更";
      resizeHandle.addEventListener("pointerdown", (event) => beginResize(event, item));
      if (item.kind === "screen") {
        resizeHandle.classList.add("screen-resize-handle");
        resizeHandle.style.left = `${item.x + item.width - 24}px`;
        resizeHandle.style.top = `${item.y + item.height - 24}px`;
        canvas.appendChild(resizeHandle);
      } else {
        element.appendChild(resizeHandle);
      }
    }
    if ((item.kind === "decision" || item.kind === "note") && (item.id === selectedId || item.data?.relatedItemId === selectedId)) {
      const linkHandle = document.createElement("button");
      linkHandle.type = "button";
      linkHandle.className = `relation-link-handle ${item.kind}-link-handle`;
      linkHandle.title = "ドラッグで関連付け／クリックで関連解除";
      linkHandle.setAttribute("aria-label", "ドラッグで関連付け、クリックで関連解除");
      linkHandle.addEventListener("pointerdown", (event) => beginObjectRelationDrag(event, item));
      element.appendChild(linkHandle);
    }
    canvas.appendChild(element);
  }

  function renderTransition(item) {
    const from = items.get(item.data.fromScreenId);
    const to = items.get(item.data.toScreenId);
    if (!from || !to) return;
    const x1 = from.x + from.width;
    const y1 = from.y + Math.min(from.height / 2, 180);
    const x2 = to.x;
    const y2 = to.y + Math.min(to.height / 2, 180);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1); line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    transitionLayer.appendChild(line);
    const label = document.createElement("button");
    label.type = "button";
    label.className = `transition-label${item.id === selectedId ? " selected" : ""}`;
    label.style.left = `${(x1 + x2) / 2}px`; label.style.top = `${(y1 + y2) / 2}px`;
    label.textContent = item.data.trigger || "操作を設定";
    label.addEventListener("click", (event) => { event.stopPropagation(); selectItem(item.id); });
    label.addEventListener("contextmenu", (event) => showContextMenu(event, item));
    canvas.appendChild(label);
  }

  function rectangleEdgePoint(from, toward) {
    const centerX = from.x + from.width / 2;
    const centerY = from.y + from.height / 2;
    const dx = toward.x + toward.width / 2 - centerX;
    const dy = toward.y + toward.height / 2 - centerY;
    if (!dx && !dy) return { x: centerX, y: centerY };
    const horizontal = Math.abs(dx) > 0 ? (from.width / 2) / Math.abs(dx) : Infinity;
    const vertical = Math.abs(dy) > 0 ? (from.height / 2) / Math.abs(dy) : Infinity;
    const factor = Math.min(horizontal, vertical);
    return { x: centerX + dx * factor, y: centerY + dy * factor };
  }

  function renderObjectRelation(item) {
    const target = items.get(item.data?.relatedItemId);
    if (!target || target.id === item.id) return;
    const start = rectangleEdgePoint(item, target);
    const end = rectangleEdgePoint(target, item);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add(`${item.kind}-link-line`);
    line.setAttribute("x1", start.x); line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x); line.setAttribute("y2", end.y);
    transitionLayer.appendChild(line);
  }

  function beginObjectRelationDrag(event, item) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();
    const start = { x: item.x + item.width, y: item.y + item.height / 2, clientX: event.clientX, clientY: event.clientY };
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "line");
    preview.classList.add(`${item.kind}-link-preview`);
    preview.setAttribute("x1", start.x); preview.setAttribute("y1", start.y);
    preview.setAttribute("x2", start.x); preview.setAttribute("y2", start.y);
    transitionLayer.appendChild(preview);
    let targetElement = null;
    let moved = false;
    const findTarget = (pointerEvent) => {
      const element = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest(".design-item");
      if (!element || element.dataset.id === item.id || !items.has(element.dataset.id)) return null;
      return element;
    };
    const move = (moveEvent) => {
      if (!moved && Math.hypot(moveEvent.clientX - start.clientX, moveEvent.clientY - start.clientY) >= 4) moved = true;
      const point = canvasPoint(moveEvent);
      preview.setAttribute("x2", point.x);
      preview.setAttribute("y2", point.y);
      const nextTarget = findTarget(moveEvent);
      if (nextTarget === targetElement) return;
      targetElement?.classList.remove("relation-link-target", `${item.kind}-link-target`);
      targetElement = nextTarget;
      targetElement?.classList.add("relation-link-target", `${item.kind}-link-target`);
    };
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const target = findTarget(upEvent);
      targetElement?.classList.remove("relation-link-target", `${item.kind}-link-target`);
      preview.remove();
      if (!moved) {
        if (!item.data.relatedItemId) {
          toolHelp.textContent = `この${item.kind === "note" ? "メモ" : "案"}には解除する関連付けがありません。ドラッグすると対象に関連付けられます。`;
          return;
        }
        item.data.relatedItemId = null;
        if (item.kind === "note") fields.noteRelatedItem.value = "";
        else fields.relatedItem.value = "";
        saveItem(item, true);
        renderAll();
        renderInspector();
        toolHelp.textContent = `${item.kind === "note" ? "メモ" : "案"}の関連付けを解除しました。`;
        return;
      }
      if (!target) {
        toolHelp.textContent = `関連付けを中止しました。${item.kind === "note" ? "青" : "オレンジ"}色の丸から対象までドラッグしてください。`;
        return;
      }
      item.data.relatedItemId = target.dataset.id;
      const targetItem = items.get(target.dataset.id);
      if (item.kind === "note") {
        fields.noteRelatedItem.value = target.dataset.id;
        item.data.screenId = targetItem?.kind === "screen" ? targetItem.id : targetItem?.data?.screenId || item.data.screenId || null;
      } else fields.relatedItem.value = target.dataset.id;
      saveItem(item, true);
      if (item.kind === "note") focusedNoteId = item.id;
      else focusedDecisionId = item.id;
      selectedId = target.dataset.id;
      renderAll();
      renderInspector();
      toolHelp.textContent = `「${itemDisplayName(targetItem)}」に関連付けました。`;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function setLinkLabelContent(label, arrow, targetName, note) {
    const text = String(note || "").trim();
    if (!text) {
      label.textContent = `${arrow} ${targetName}`;
      return;
    }
    label.classList.add("has-note");
    label.innerHTML = `<strong>${arrow} ${escapeHtml(targetName)}</strong><small>${escapeHtml(text)}</small>`;
  }

  function renderComponentLink(item) {
    const target = items.get(item.data.linkScreenId);
    if (!target || target.kind !== "screen") return;
    if (target.id === item.data?.screenId) {
      const label = document.createElement("button");
      label.type = "button";
      label.className = `link-label self-link-label${item.id === selectedId ? " selected" : ""}`;
      label.style.left = `${item.x + item.width / 2}px`;
      label.style.top = `${item.y - 12}px`;
      setLinkLabelContent(label, "↺", target.data?.name || "現在の画面", item.data.linkNote);
      label.addEventListener("click", (event) => { event.stopPropagation(); selectItem(item.id); });
      label.addEventListener("contextmenu", (event) => showContextMenu(event, item));
      canvas.appendChild(label);
      return;
    }
    const sourceCenterX = item.x + item.width / 2;
    const targetCenterX = target.x + target.width / 2;
    const toRight = targetCenterX >= sourceCenterX;
    const x1 = toRight ? item.x + item.width : item.x;
    const y1 = item.y + item.height / 2;
    const x2 = toRight ? target.x : target.x + target.width;
    const y2 = target.y + Math.min(target.height / 2, 180);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("link-line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1); line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    transitionLayer.appendChild(line);
    const label = document.createElement("button");
    label.type = "button";
    label.className = `link-label${item.id === selectedId ? " selected" : ""}`;
    label.style.left = `${(x1 + x2) / 2}px`;
    label.style.top = `${(y1 + y2) / 2}px`;
    setLinkLabelContent(label, "→", target.data?.name || "リンク先画面", item.data.linkNote);
    label.addEventListener("click", (event) => { event.stopPropagation(); selectItem(item.id); });
    label.addEventListener("contextmenu", (event) => showContextMenu(event, item));
    canvas.appendChild(label);
  }

  function renderComponentCallouts(item) {
    const x1 = item.x + item.width;
    const y1 = item.y + item.height / 2;
    const callouts = [];
    if (String(item.data.behavior || "").trim()) callouts.push({ type: "behavior", label: "操作時の動作", text: item.data.behavior });
    if (String(item.data.memo || "").trim()) callouts.push({ type: "memo", label: "補足メモ", text: item.data.memo });
    callouts.forEach((data, index) => {
      const saved = item.data.calloutPositions?.[data.type];
      const calloutX = item.x + (Number.isFinite(saved?.x) ? saved.x : item.width + 68);
      const calloutY = item.y + (Number.isFinite(saved?.y) ? saved.y : -8 + index * 78);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.classList.add("behavior-line", `${data.type}-line`);
      line.setAttribute("x1", x1); line.setAttribute("y1", y1); line.setAttribute("x2", calloutX); line.setAttribute("y2", calloutY + 25);
      transitionLayer.appendChild(line);
      const callout = document.createElement("button");
      callout.type = "button";
      callout.className = `behavior-callout ${data.type}-callout${item.id === selectedId ? " selected" : ""}`;
      callout.style.left = `${calloutX}px`; callout.style.top = `${calloutY}px`;
      callout.innerHTML = `<small>${data.label}</small>${escapeHtml(data.text)}`;
      callout.addEventListener("pointerdown", (event) => beginCalloutDrag(event, item, data.type, calloutX, calloutY));
      callout.addEventListener("click", (event) => { event.stopPropagation(); selectItem(item.id); });
      callout.addEventListener("contextmenu", (event) => showContextMenu(event, item));
      canvas.appendChild(callout);
    });
  }

  function renderScreenDescriptionCallout(item) {
    const saved = item.data.calloutPositions?.description;
    const calloutX = item.x + (Number.isFinite(saved?.x) ? saved.x : item.width + 68);
    const calloutY = item.y + (Number.isFinite(saved?.y) ? saved.y : 56);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("description-line");
    line.setAttribute("x1", item.x + item.width);
    line.setAttribute("y1", item.y + 80);
    line.setAttribute("x2", calloutX);
    line.setAttribute("y2", calloutY + 25);
    transitionLayer.appendChild(line);
    const callout = document.createElement("button");
    callout.type = "button";
    callout.className = `behavior-callout description-callout${item.id === selectedId ? " selected" : ""}`;
    callout.style.left = `${calloutX}px`;
    callout.style.top = `${calloutY}px`;
    callout.innerHTML = `<small>画面の説明</small>${escapeHtml(item.data.description)}`;
    callout.addEventListener("pointerdown", (event) => beginCalloutDrag(event, item, "description", calloutX, calloutY));
    callout.addEventListener("click", (event) => { event.stopPropagation(); selectItem(item.id); });
    callout.addEventListener("contextmenu", (event) => showContextMenu(event, item));
    canvas.appendChild(callout);
  }

  function beginCalloutDrag(event, item, type, calloutX, calloutY) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectedId = item.id;
    renderInspector();
    const start = { x: event.clientX, y: event.clientY, offsetX: calloutX - item.x, offsetY: calloutY - item.y };
    const move = (moveEvent) => {
      item.data.calloutPositions = { ...(item.data.calloutPositions || {}) };
      item.data.calloutPositions[type] = {
        x: snap(start.offsetX + (moveEvent.clientX - start.x) / zoom),
        y: snap(start.offsetY + (moveEvent.clientY - start.y) / zoom),
      };
      renderAll();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveItem(item, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function beginDrag(event, item) {
    if (placementTool || transitionSourceId || event.button !== 0 || event.target.closest(".resize-handle")) return;
    event.preventDefault();
    event.stopPropagation();
    selectItem(item.id);
    const start = { x: event.clientX, y: event.clientY, itemX: item.x, itemY: item.y, screenId: item.data?.screenId || null };
    const children = item.kind === "screen"
      ? [...items.values()].filter((candidate) => candidate.id !== item.id && candidate.kind !== "transition" && candidate.data?.screenId === item.id).map((child) => ({ item: child, x: child.x, y: child.y }))
      : [];
    const move = (moveEvent) => {
      const dx = snap((moveEvent.clientX - start.x) / zoom);
      const dy = snap((moveEvent.clientY - start.y) / zoom);
      item.x = Math.max(16, start.itemX + dx);
      item.y = Math.max(16, start.itemY + dy);
      const actualDx = item.x - start.itemX;
      const actualDy = item.y - start.itemY;
      children.forEach((child) => { child.item.x = child.x + actualDx; child.item.y = child.y + actualDy; });
      renderAll();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const changed = [item, ...children.map((child) => child.item)];
      if (item.kind !== "screen" && item.kind !== "transition") {
        const parent = findContainingScreen(item.x + item.width / 2, item.y + item.height / 2);
        const role = item.kind === "component" && layoutTypes.has(item.data?.componentType) ? canonicalLayoutType(item.data.componentType) : null;
        const conflict = role && parent && [...items.values()].find((candidate) => candidate.id !== item.id && candidate.kind === "component" && candidate.data?.screenId === parent.id && canonicalLayoutType(candidate.data?.componentType) === role);
        if (conflict) {
          item.x = start.itemX;
          item.y = start.itemY;
          item.data.screenId = start.screenId;
          const originalScreen = items.get(start.screenId);
          if (originalScreen) attachToScreen(item, originalScreen);
          toolHelp.textContent = `${componentLabel[item.data.componentType]}は移動先の画面にすでにあります。`;
        } else {
          item.data.screenId = parent?.id || null;
          if (parent) attachToScreen(item, parent);
        }
        if (role) {
          [start.screenId, item.data.screenId].filter(Boolean).forEach((screenId) => {
            const affectedScreen = items.get(screenId);
            if (affectedScreen?.kind === "screen") changed.push(...refreshScreenLayouts(affectedScreen));
          });
        }
      }
      renderAll();
      saveMany([...new Map(changed.map((changedItem) => [changedItem.id, changedItem])).values()]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function beginResize(event, item) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, width: item.width, height: item.height };
    const min = item.kind === "screen" ? { width: 160, height: 180 } : item.kind === "component" ? { width: 80, height: 28 } : { width: 120, height: 80 };
    const attachedChildren = item.kind === "screen"
      ? [...items.values()].filter((candidate) => candidate.kind === "component" && candidate.data?.screenId === item.id && layoutTypes.has(candidate.data?.componentType))
      : [];
    let affectedLayouts = attachedChildren;
    const move = (moveEvent) => {
      item.width = Math.max(min.width, snap(start.width + (moveEvent.clientX - start.x) / zoom));
      item.height = Math.max(min.height, snap(start.height + (moveEvent.clientY - start.y) / zoom));
      if (item.kind === "screen") affectedLayouts = refreshScreenLayouts(item);
      if (item.kind === "component" && layoutTypes.has(item.data?.componentType)) {
        const parent = items.get(item.data?.screenId) || findContainingScreen(item.x + item.width / 2, item.y + item.height / 2);
        if (parent) affectedLayouts = refreshScreenLayouts(parent);
      }
      renderAll();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveMany([...new Map([item, ...affectedLayouts].map((changedItem) => [changedItem.id, changedItem])).values()]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function selectItem(id) {
    const selected = items.get(id);
    focusedDecisionId = null;
    focusedNoteId = null;
    if ((selected?.kind === "decision" || selected?.kind === "note") && selected.data?.relatedItemId && items.has(selected.data.relatedItemId)) {
      if (selected.kind === "decision") focusedDecisionId = selected.id;
      else focusedNoteId = selected.id;
      id = selected.data.relatedItemId;
    }
    selectedId = id;
    renderAll();
    renderInspector();
  }

  function removeMenuItem(item, menuItemId) {
    if (!item || item.kind !== "component" || item.data?.componentType !== "menu" || !Array.isArray(item.data.menuItems)) return;
    const index = item.data.menuItems.findIndex((menuItem) => menuItem.id === menuItemId);
    if (index < 0) return;
    const [removed] = item.data.menuItems.splice(index, 1);
    saveItem(item, true);
    renderAll();
    renderInspector();
    toolHelp.textContent = `メニュー項目「${removed?.label || "名称未設定"}」を削除しました。`;
  }

  function renderMenuItemsEditor(item) {
    if (!item || item.kind !== "component" || item.data?.componentType !== "menu") {
      menuItemsEditor.innerHTML = "";
      return;
    }
    if (!Array.isArray(item.data.menuItems)) {
      item.data.menuItems = defaultMenuItems();
      saveItem(item, true);
    }
    const screens = [...items.values()].filter((candidate) => candidate.kind === "screen");
    menuItemsEditor.innerHTML = item.data.menuItems.map((menuItem, index) => {
      const options = screens.map((screen) => `<option value="${escapeHtml(screen.id)}"${screen.id === menuItem.linkScreenId ? " selected" : ""}>${escapeHtml(screen.data?.name || "名称未設定")}</option>`).join("");
      return `<section class="menu-editor-item" data-menu-item-id="${escapeHtml(menuItem.id || "")}">
        <div class="menu-editor-item-head"><span>項目 ${index + 1}</span><button class="menu-item-remove" type="button">− この項目を削除</button></div>
        <label>表示名<input class="menu-item-label" value="${escapeHtml(menuItem.label || "")}" placeholder="例: プロフィール" /></label>
        <label>リンク先画面<select class="menu-item-link"><option value="">リンクなし</option>${options}</select></label>
        <label>補足・条件<textarea class="menu-item-note" rows="2" placeholder="例: そのユーザーのプロフィールを表示">${escapeHtml(menuItem.note || "")}</textarea></label>
      </section>`;
    }).join("");
    menuItemsEditor.querySelectorAll(".menu-editor-item").forEach((row, index) => {
      const menuItem = item.data.menuItems[index];
      row.querySelector(".menu-item-label").addEventListener("input", (event) => {
        menuItem.label = event.target.value;
        saveItem(item);
        renderAll();
      });
      row.querySelector(".menu-item-link").addEventListener("change", (event) => {
        menuItem.linkScreenId = event.target.value || null;
        saveItem(item, true);
        renderAll();
      });
      row.querySelector(".menu-item-note").addEventListener("input", (event) => {
        menuItem.note = event.target.value;
        saveItem(item);
        renderAll();
      });
      row.querySelector(".menu-item-remove").addEventListener("click", () => {
        removeMenuItem(item, menuItem.id);
      });
    });
  }

  function renderRelatedDecisionsPanel(item) {
    const visible = !!item && item.kind !== "transition" && item.kind !== "decision";
    relatedDecisionsPanel.classList.toggle("hidden", !visible);
    if (!visible) {
      relatedDecisionsList.innerHTML = "";
      inspectorAddDecision.dataset.targetId = "";
      return;
    }
    const related = [...items.values()].filter((candidate) => candidate.kind === "decision" && candidate.data?.relatedItemId === item.id);
    relatedDecisionsCount.textContent = `${related.length}件`;
    inspectorAddDecision.dataset.targetId = item.id;
    relatedDecisionsList.innerHTML = related.length
      ? related.map((decision) => {
        const decided = decision.data?.status === "decided";
        const done = !!decision.data?.done;
        return `<section class="related-decision-editor${focusedDecisionId === decision.id ? " focused" : ""}${done ? " done" : ""}" data-related-decision-id="${escapeHtml(decision.id)}">
          <div class="related-decision-editor-head"><strong>案</strong>${done ? "<span>済</span>" : decided ? "<span>決定済み</span>" : ""}</div>
          <label>名前（案名）<input class="related-decision-name" maxlength="120" value="${escapeHtml(decision.data?.question || "")}" /></label>
          <label class="related-decision-options${decided ? " hidden" : ""}">候補（1行に1つ）<textarea class="related-decision-options-input" rows="4">${escapeHtml((decision.data?.options || []).join("\n"))}</textarea></label>
          <label>決定事項<input class="related-decision-resolution" value="${escapeHtml(decision.data?.resolution || "")}" /></label>
          <label class="check"><input class="related-decision-decided" type="checkbox"${decided ? " checked" : ""} /> 決定済みにする</label>
          <label class="check"><input class="related-decision-done" type="checkbox"${done ? " checked" : ""} /> 済（キャンバスでは非表示）</label>
        </section>`;
      }).join("")
      : '<div class="related-decisions-empty">関連する案はまだありません</div>';
    relatedDecisionsList.querySelectorAll("[data-related-decision-id]").forEach((editor) => {
      const decision = items.get(editor.dataset.relatedDecisionId);
      if (!decision) return;
      const saveInlineDecision = (rerenderInspector = false) => {
        decision.data.question = editor.querySelector(".related-decision-name").value;
        decision.data.options = editor.querySelector(".related-decision-options-input").value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
        decision.data.resolution = editor.querySelector(".related-decision-resolution").value;
        decision.data.status = editor.querySelector(".related-decision-decided").checked ? "decided" : "open";
        decision.data.done = editor.querySelector(".related-decision-done").checked;
        saveItem(decision);
        renderAll();
        if (rerenderInspector) renderInspector();
      };
      editor.querySelectorAll("input:not([type='checkbox']), textarea").forEach((field) => {
        field.addEventListener("input", () => saveInlineDecision(false));
        field.addEventListener("change", () => saveItem(decision, true));
      });
      editor.querySelector(".related-decision-decided").addEventListener("change", () => saveInlineDecision(true));
      editor.querySelector(".related-decision-done").addEventListener("change", () => saveInlineDecision(true));
    });
    if (focusedDecisionId) {
      const focused = relatedDecisionsList.querySelector(`[data-related-decision-id="${CSS.escape(focusedDecisionId)}"]`);
      focused?.scrollIntoView({ block: "nearest" });
      focusedDecisionId = null;
    }
  }

  function renderRelatedNotesPanel(item) {
    const visible = !!item && item.kind !== "transition" && item.kind !== "decision" && item.kind !== "note";
    relatedNotesPanel.classList.toggle("hidden", !visible);
    if (!visible) {
      relatedNotesList.innerHTML = "";
      inspectorAddNote.dataset.targetId = "";
      return;
    }
    const related = [...items.values()].filter((candidate) => candidate.kind === "note" && candidate.data?.relatedItemId === item.id);
    relatedNotesCount.textContent = `${related.length}件`;
    inspectorAddNote.dataset.targetId = item.id;
    relatedNotesList.innerHTML = related.length
      ? related.map((note) => `<section class="related-note-editor${focusedNoteId === note.id ? " focused" : ""}" data-related-note-id="${escapeHtml(note.id)}">
          <div class="related-note-editor-head"><strong>メモ</strong></div>
          <label>メモ名<input class="related-note-title" maxlength="120" value="${escapeHtml(note.data?.title || "")}" /></label>
          <label>内容<textarea class="related-note-body" rows="4">${escapeHtml(note.data?.body || "")}</textarea></label>
        </section>`).join("")
      : '<div class="related-notes-empty">関連するメモはまだありません</div>';
    relatedNotesList.querySelectorAll("[data-related-note-id]").forEach((editor) => {
      const note = items.get(editor.dataset.relatedNoteId);
      if (!note) return;
      const saveInlineNote = () => {
        note.data.title = editor.querySelector(".related-note-title").value;
        note.data.body = editor.querySelector(".related-note-body").value;
        saveItem(note);
        renderAll();
      };
      editor.querySelectorAll("input, textarea").forEach((field) => {
        field.addEventListener("input", saveInlineNote);
        field.addEventListener("change", () => saveItem(note, true));
      });
    });
    if (focusedNoteId) {
      const focused = relatedNotesList.querySelector(`[data-related-note-id="${CSS.escape(focusedNoteId)}"]`);
      focused?.scrollIntoView({ block: "nearest" });
      focusedNoteId = null;
    }
  }

  function renderInspector() {
    const item = items.get(selectedId);
    inspectorEmpty.classList.toggle("hidden", !!item);
    inspectorForm.classList.toggle("hidden", !item);
    if (!item) {
      renderRelatedDecisionsPanel(null);
      renderRelatedNotesPanel(null);
      return;
    }
    fields.kind.textContent = kindLabel[item.kind] || item.kind;
    fields.heading.textContent = item.kind === "component" ? componentLabel[item.data.componentType] || "UI部品" : kindLabel[item.kind];
    fields.name.value = item.kind === "note" ? item.data.title || "" : item.kind === "decision" ? item.data.question || "" : item.data.name || "";
    fields.textContent.value = item.kind === "component" && item.data.componentType === "text" ? (item.data.textContent ?? "ここにテキストが入ります") : "";
    nameFieldLabel.textContent = item.kind === "decision"
      ? "名前（案名）"
      : item.kind === "note" ? "メモ名"
      : item.kind === "component" && item.data.componentType === "text" ? "タイトル（設計上の名前）" : "名前";
    descriptionFieldLabel.textContent = item.kind === "note" ? "内容" : "説明";
    fields.description.value = item.kind === "note" ? item.data.body || "" : item.data.description || "";
    fields.behavior.value = item.data.behavior || "";
    fields.memo.value = item.data.memo || "";
    fields.color.value = item.data.color || componentDefaultColor[item.data.componentType] || "#ffffff";
    fields.linkScreen.innerHTML = `<option value="">リンクなし</option>${[...items.values()].filter((candidate) => candidate.kind === "screen").map((screen) => `<option value="${escapeHtml(screen.id)}">${escapeHtml(screen.data?.name || "名称未設定")}</option>`).join("")}`;
    fields.linkScreen.value = item.data.linkScreenId || "";
    fields.linkNote.value = item.data.linkNote || "";
    fields.menuDirection.value = item.data.menuDirection || "auto";
    fields.trigger.value = item.data.trigger || "";
    fields.condition.value = item.data.condition || "";
    fields.options.value = (item.data.options || []).join("\n");
    fields.resolution.value = item.data.resolution || "";
    const relationOptions = [...items.values()].filter((candidate) => candidate.id !== item.id && candidate.kind !== "transition").map((candidate) => `<option value="${escapeHtml(candidate.id)}">${candidate.kind === "screen" ? "画面" : candidate.kind === "component" ? componentLabel[candidate.data?.componentType] || "UI部品" : kindLabel[candidate.kind] || "対象"}: ${escapeHtml(itemDisplayName(candidate))}</option>`).join("");
    fields.relatedItem.innerHTML = `<option value="">関連付けなし</option>${relationOptions}`;
    fields.relatedItem.value = item.data.relatedItemId || "";
    fields.noteRelatedItem.innerHTML = `<option value="">関連付けなし</option>${relationOptions}`;
    fields.noteRelatedItem.value = item.data.relatedItemId || "";
    fields.decided.checked = item.data.status === "decided";
    fields.done.checked = !!item.data.done;
    document.getElementById("decision-options-row").classList.toggle("hidden", item.kind === "decision" && fields.decided.checked);
    document.getElementById("description-row").classList.toggle("hidden", item.kind === "component" || item.kind === "transition" || item.kind === "decision");
    document.getElementById("text-content-row").classList.toggle("hidden", item.kind !== "component" || item.data.componentType !== "text");
    document.getElementById("behavior-row").classList.toggle("hidden", item.kind !== "component");
    document.getElementById("memo-row").classList.toggle("hidden", item.kind !== "component");
    document.getElementById("color-row").classList.toggle("hidden", item.kind !== "component");
    const isMenu = item.kind === "component" && item.data?.componentType === "menu";
    document.getElementById("link-row").classList.toggle("hidden", item.kind !== "component" || layoutTypes.has(item.data?.componentType) || isMenu);
    document.getElementById("link-note-row").classList.toggle("hidden", item.kind !== "component" || layoutTypes.has(item.data?.componentType) || isMenu || !item.data?.linkScreenId);
    menuFields.classList.toggle("hidden", !isMenu);
    renderMenuItemsEditor(isMenu ? item : null);
    document.getElementById("image-row").classList.toggle("hidden", item.kind !== "component" || item.data.componentType !== "image");
    document.getElementById("copy-layout-row").classList.toggle("hidden", item.kind !== "component" || !layoutTypes.has(item.data?.componentType));
    copyLayoutButton.textContent = item.data?.applyToNewScreens ? "全画面を更新" : "全画面にコピー";
    document.getElementById("transition-fields").classList.toggle("hidden", item.kind !== "transition");
    document.getElementById("note-fields").classList.toggle("hidden", item.kind !== "note");
    document.getElementById("decision-fields").classList.toggle("hidden", item.kind !== "decision");
    renderRelatedDecisionsPanel(item);
    renderRelatedNotesPanel(item);
  }

  function applyInspector() {
    const item = items.get(selectedId);
    if (!item) return;
    if (item.kind === "note") {
      item.data.title = fields.name.value;
      item.data.body = fields.description.value;
      item.data.relatedItemId = fields.noteRelatedItem.value || null;
      const target = items.get(item.data.relatedItemId);
      if (target) item.data.screenId = target.kind === "screen" ? target.id : target.data?.screenId || item.data.screenId || null;
    } else if (item.kind === "decision") {
      item.data.question = fields.name.value;
      item.data.options = fields.options.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      item.data.resolution = fields.resolution.value;
      item.data.relatedItemId = fields.relatedItem.value || null;
      item.data.status = fields.decided.checked ? "decided" : "open";
      item.data.done = fields.done.checked;
      document.getElementById("decision-options-row").classList.toggle("hidden", fields.decided.checked);
    } else {
      item.data.name = fields.name.value;
      item.data.description = fields.description.value;
      item.data.behavior = fields.behavior.value;
      item.data.memo = fields.memo.value;
      if (item.kind === "component") {
        item.data.color = fields.color.value;
        if (item.data.componentType !== "menu" && !layoutTypes.has(item.data.componentType)) {
          item.data.linkScreenId = fields.linkScreen.value || null;
          item.data.linkNote = fields.linkNote.value;
          document.getElementById("link-note-row").classList.toggle("hidden", !item.data.linkScreenId);
        }
        if (item.data.componentType === "menu") item.data.menuDirection = fields.menuDirection.value || "auto";
        if (item.data.componentType === "text") item.data.textContent = fields.textContent.value;
      }
    }
    if (item.kind === "transition") {
      item.data.trigger = fields.trigger.value;
      item.data.condition = fields.condition.value;
    }
    saveItem(item);
    renderAll();
    if ((item.kind === "decision" || item.kind === "note") && item.data.relatedItemId && items.has(item.data.relatedItemId)) {
      if (item.kind === "decision") focusedDecisionId = item.id;
      else focusedNoteId = item.id;
      selectedId = item.data.relatedItemId;
      renderAll();
      renderInspector();
    }
  }

  function startTransition() {
    const sourceId = getSelectedScreenId();
    if (!sourceId) { toolHelp.textContent = "先に遷移元の画面を選択してください。"; return; }
    cancelPlacement("");
    transitionSourceId = sourceId;
    transitionTool.classList.add("active");
    toolHelp.textContent = "遷移先の画面をクリックしてください。Escで中止できます。";
  }

  function finishTransition(targetId) {
    if (!transitionSourceId || transitionSourceId === targetId) return;
    const from = items.get(transitionSourceId);
    const to = items.get(targetId);
    const existing = [...items.values()].find((candidate) => candidate.kind === "transition" && candidate.data?.fromScreenId === from.id && candidate.data?.toScreenId === to.id);
    if (existing) {
      transitionSourceId = null;
      transitionTool.classList.remove("active");
      toolHelp.textContent = "この向きの画面遷移はすでにあります。既存の遷移を選択しました。";
      selectItem(existing.id);
      return;
    }
    const item = normalize({
      id: uid(), kind: "transition", x: 0, y: 0, width: 40, height: 28, zIndex: nextZ("transition"), createdBy: currentUser, createdAt: Date.now(),
      data: { fromScreenId: from.id, toScreenId: to.id, name: `${from.data.name} → ${to.data.name}`, trigger: "", condition: "" },
    });
    transitionSourceId = null;
    transitionTool.classList.remove("active");
    toolHelp.textContent = "遷移を追加しました。右側で操作と条件を書けます。";
    items.set(item.id, item);
    saveItem(item, true);
    selectItem(item.id);
  }

  function deleteSelected() {
    const item = items.get(selectedId);
    if (!item || !window.confirm(`「${kindLabel[item.kind]}」を削除しますか？`)) return;
    const affectedLayoutScreenId = item.kind === "component" && layoutTypes.has(item.data?.componentType) ? item.data?.screenId : null;
    const removeIds = new Set([item.id]);
    if (item.kind === "screen") {
      [...items.values()].forEach((candidate) => {
        if (candidate.data?.screenId === item.id || candidate.data?.fromScreenId === item.id || candidate.data?.toScreenId === item.id) removeIds.add(candidate.id);
        if (candidate.kind === "component" && candidate.data?.linkScreenId === item.id && candidate.data?.screenId !== item.id) {
          candidate.data.linkScreenId = null;
          saveItem(candidate, true);
        }
        if (candidate.kind === "component" && Array.isArray(candidate.data?.menuItems)) {
          let changed = false;
          candidate.data.menuItems.forEach((menuItem) => {
            if (menuItem.linkScreenId === item.id) {
              menuItem.linkScreenId = null;
              changed = true;
            }
          });
          if (changed) saveItem(candidate, true);
        }
      });
    }
    [...items.values()].forEach((candidate) => {
      if (!removeIds.has(candidate.id) && removeIds.has(candidate.data?.relatedItemId)) {
        candidate.data.relatedItemId = null;
        saveItem(candidate, true);
      }
    });
    removeIds.forEach((id) => {
      items.delete(id);
      socket.emit("design:item:remove", { boardId, id });
    });
    const affectedScreen = items.get(affectedLayoutScreenId);
    if (affectedScreen?.kind === "screen") saveMany(refreshScreenLayouts(affectedScreen));
    selectedId = null;
    renderAll();
    renderInspector();
  }

  document.querySelectorAll("[data-create]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.create === "component" && layoutTypes.has(button.dataset.component)) {
      createAttachedComponent(button.dataset.component);
      return;
    }
    activatePlacement(button.dataset.create, button.dataset.component || null, button);
  }));
  transitionTool.addEventListener("click", startTransition);
  document.getElementById("expand-canvas").addEventListener("click", () => {
    setCanvasSize(canvasWidth + 1600, canvasHeight + 1000);
    toolHelp.textContent = `作業領域を ${canvasWidth} × ${canvasHeight} に広げました。右ドラッグで移動できます。`;
  });
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    hideContextMenu();
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const canvasX = (viewport.scrollLeft + pointerX) / zoom;
    const canvasY = (viewport.scrollTop + pointerY) / zoom;
    const nextZoom = zoom * Math.exp(-event.deltaY * 0.0015);
    applyZoom(nextZoom);
    viewport.scrollLeft = canvasX * zoom - pointerX;
    viewport.scrollTop = canvasY * zoom - pointerY;
    toolHelp.textContent = `拡大率 ${Math.round(zoom * 100)}%。右ドラッグまたはホイールボタンのドラッグで移動できます。`;
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 1 && event.button !== 2) return;
    if (!userModal.classList.contains("hidden")) return;
    if (event.button === 1) event.preventDefault();
    hideContextMenu();
    const start = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    let moved = false;
    const move = (moveEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      moveEvent.preventDefault();
      viewport.classList.add("panning");
      viewport.scrollLeft = start.left - dx;
      viewport.scrollTop = start.top - dy;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      viewport.classList.remove("panning");
      if (moved) {
        suppressPanContextMenu = true;
        toolHelp.textContent = `キャンバスを移動しました。拡大率 ${Math.round(zoom * 100)}%。`;
        window.setTimeout(() => { suppressPanContextMenu = false; }, 250);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  });
  viewport.addEventListener("contextmenu", (event) => {
    if (!suppressPanContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    suppressPanContextMenu = false;
  }, true);
  viewport.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  canvas.addEventListener("pointerdown", beginPlacement);
  canvas.addEventListener("click", () => {
    if (suppressCanvasClick) { suppressCanvasClick = false; return; }
    if (!transitionSourceId && !placementTool) selectItem(null);
  });
  window.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const editing = ["input", "textarea", "select"].includes(tag) || document.activeElement?.isContentEditable;
    if (event.key === "Escape") {
      hideContextMenu();
      transitionSourceId = null;
      transitionTool.classList.remove("active");
      cancelPlacement("操作を中止しました。");
    } else if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) {
      event.preventDefault();
      duplicateSelected();
    } else if (!editing && (event.key === "Delete" || event.key === "Backspace") && selectedId) {
      event.preventDefault();
      deleteSelected();
    }
  });
  Object.values(fields)
    .filter((field) => field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
    .forEach((field) => field.addEventListener("input", applyInspector));
  fields.color.addEventListener("change", () => rememberRecentColor(fields.color.value));
  document.getElementById("delete-item").addEventListener("click", deleteSelected);
  inspectorAddDecision.addEventListener("click", () => {
    createDecisionForTarget(items.get(inspectorAddDecision.dataset.targetId));
  });
  inspectorAddNote.addEventListener("click", () => {
    createNoteForTarget(items.get(inspectorAddNote.dataset.targetId));
  });
  contextDuplicate.addEventListener("click", duplicateSelected);
  contextDelete.addEventListener("click", () => {
    hideContextMenu();
    deleteSelected();
  });
  window.addEventListener("pointerdown", (event) => {
    if (!contextMenu.contains(event.target)) hideContextMenu();
  });
  viewport.addEventListener("scroll", hideContextMenu);
  addMenuItemButton.addEventListener("click", () => {
    const item = items.get(selectedId);
    if (!item || item.kind !== "component" || item.data?.componentType !== "menu") return;
    if (!Array.isArray(item.data.menuItems)) item.data.menuItems = [];
    item.data.menuItems.push({ id: uid(), label: `メニュー項目 ${item.data.menuItems.length + 1}`, linkScreenId: null, note: "" });
    saveItem(item, true);
    renderAll();
    renderMenuItemsEditor(item);
  });
  copyLayoutButton.addEventListener("click", () => copyLayoutToAllScreens(items.get(selectedId)));
  resetColorButton.addEventListener("click", () => {
    const item = items.get(selectedId);
    if (!item || item.kind !== "component") return;
    delete item.data.color;
    fields.color.value = componentDefaultColor[item.data.componentType] || "#ffffff";
    saveItem(item, true);
    renderAll();
  });
  imageInput.addEventListener("change", async () => {
    const item = items.get(selectedId);
    const file = imageInput.files?.[0];
    if (!item || item.kind !== "component" || item.data.componentType !== "image" || !file) return;
    const previousSrc = item.data.imageSrc || "";
    const previewSrc = URL.createObjectURL(file);
    item.data.imageSrc = previewSrc;
    renderAll();
    saveState.textContent = "画像を送信中…";
    const body = new FormData();
    body.append("image", file);
    try {
      const response = await fetch(appUrl(`api/boards/${encodeURIComponent(boardId)}/design-image`), { method: "POST", body });
      const responseText = await response.text();
      let result = {};
      try { result = JSON.parse(responseText); } catch (_parseError) { result = { error: responseText || `HTTP ${response.status}` }; }
      if (!response.ok || !result.src) throw new Error(result.error || "upload failed");
      item.data.imageSrc = result.src;
      if (!item.data.name || item.data.name === componentLabel.image) item.data.name = file.name.replace(/\.[^.]+$/, "") || componentLabel.image;
      fields.name.value = item.data.name;
      saveItem(item, true);
      renderAll();
      saveState.textContent = "保存済み";
    } catch (error) {
      item.data.imageSrc = previousSrc;
      renderAll();
      saveState.textContent = "画像を追加できませんでした";
      window.alert(`画像を追加できませんでした。\n${error.message || "サーバーを再起動してお試しください。"}`);
    } finally {
      URL.revokeObjectURL(previewSrc);
      imageInput.value = "";
    }
  });

  userForm.addEventListener("submit", (event) => {
    event.preventDefault();
    currentUser = userNameInput.value.trim();
    if (!currentUser) return;
    localStorage.setItem("screen-design-user", currentUser);
    userModal.classList.add("hidden");
    socket.emit("user:identify", { boardId, user: currentUser, presence: true });
  });

  socket.on("connect", () => {
    saveState.textContent = "接続済み";
    socket.emit("join", { boardId });
    if (currentUser) socket.emit("user:identify", { boardId, user: currentUser, presence: true });
  });
  socket.on("disconnect", () => { saveState.textContent = "再接続中…"; });
  socket.on("init", (state) => { document.getElementById("board-title").textContent = state.title || "画面設計ボード"; });
  socket.on("design:init", (serverItems) => {
    items.clear();
    (serverItems || []).forEach((item) => items.set(item.id, normalize(item)));
    const refreshedLayouts = recoverInvisibleScreens();
    [...items.values()].filter((item) => item.kind === "screen").forEach((screen) => refreshedLayouts.push(...refreshScreenLayouts(screen)));
    if (refreshedLayouts.length) saveMany([...new Map(refreshedLayouts.map((item) => [item.id, item])).values()]);
    renderAll();
  });
  socket.on("design:item:save", (item) => {
    const previous = items.get(item.id);
    items.set(item.id, normalize(item));
    renderAll();
    if (item.id === selectedId || item.data?.relatedItemId === selectedId || previous?.data?.relatedItemId === selectedId) renderInspector();
  });
  socket.on("design:item:remove", ({ id }) => {
    const removed = items.get(id);
    items.delete(id);
    if (selectedId === id) selectedId = null;
    renderAll();
    if (selectedId === null || removed?.data?.relatedItemId === selectedId) renderInspector();
  });
  socket.on("presence:users", (users) => {
    const count = Math.max(1, (users || []).length);
    document.getElementById("online-users").textContent = `${count}人で編集中`;
  });
  socket.on("error-message", (message) => { saveState.textContent = String(message || "エラー"); });
  renderRecentColors();
  renderAll();
})();
