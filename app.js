const desktopMode = document.getElementById("desktopMode");
const mobileMode = document.getElementById("mobileMode");
const modeChooser = document.getElementById("modeChooser");
const modeButtons = document.querySelectorAll("[data-mode]");
const startModeButtons = document.querySelectorAll("[data-start-mode]");
const showChooserButtons = document.querySelectorAll("[data-show-chooser]");
const themeSwitch = document.getElementById("themeSwitch");

const connectionCanvas = document.getElementById("connectionCanvas");
const ctx = connectionCanvas.getContext("2d");
const workflowViewport = document.getElementById("workflowViewport");
const zoomText = document.getElementById("zoomText");
const workflowFile = document.getElementById("workflowFile");
const contextMenu = document.getElementById("contextMenu");
const nodeMenu = document.getElementById("nodeMenu");
const guidePanel = document.getElementById("guidePanel");
const templatePanel = document.getElementById("templatePanel");
const historyPanel = document.getElementById("historyPanel");
const lineStylePanel = document.getElementById("lineStylePanel");
const historyList = document.getElementById("historyList");
const lineColorMode = document.getElementById("lineColorMode");
const lineCustomColor = document.getElementById("lineCustomColor");
const lineType = document.getElementById("lineType");
const linePattern = document.getElementById("linePattern");
const lineWidth = document.getElementById("lineWidth");
const lineWidthValue = document.getElementById("lineWidthValue");

const referenceInput = document.getElementById("referenceInput");
const referencePreview = document.getElementById("referencePreview");
const uploadZone = document.querySelector(".upload-zone");
const promptInput = document.getElementById("promptInput");
const modelSelect = document.getElementById("modelSelect");
const apiEndpoint = document.getElementById("apiEndpoint");
const apiKey = document.getElementById("apiKey");
const generateButton = document.getElementById("generateButton");
const generateStatus = document.getElementById("generateStatus");
const resultBox = document.getElementById("resultBox");
const downloadResultButton = document.getElementById("downloadResultButton");
const copyPayloadButton = document.getElementById("copyPayloadButton");

const camera = { x: 0, y: 0, scale: 1 };
const defaultLineStyle = {
  colorMode: "orange",
  customColor: "#c45a00",
  type: "curve",
  pattern: "solid",
  width: 4,
};
let nodes = [];
let connections = [];
let historyItems = [];
let lineStyle = { ...defaultLineStyle };
let selectedNodeIds = new Set();
let pendingConnection = null;
let pointerPosition = null;
let dragState = null;
let panState = null;
let contextWorldPosition = { x: 0, y: 0 };
let activeNodeMenuId = null;
let copiedGraph = null;
let referenceDataUrl = "";
let resultDataUrl = "";
let lastPayload = null;
const undoStack = [];

const nodeTypes = {
  "image-generation": {
    icon: "🎨",
    title: "图像生成",
    badge: "AI 模型",
    className: "image-node",
    inputs: [
      ["ref1", "图1", "green"],
      ["ref2", "图2", "green"],
      ["ref3", "图3", "green"],
      ["ref4", "图4", "green"],
      ["ref5", "图5", "green"],
      ["system", "系统提示词", "orange"],
      ["user", "用户提示词", "orange"],
    ],
    outputs: [["image", "图片输出", "green"]],
  },
  chat: {
    icon: "💬",
    title: "智能对话",
    badge: "AI 模型",
    className: "chat-node",
    inputs: [
      ["ref1", "图1", "green"],
      ["ref2", "图2", "green"],
      ["ref3", "图3", "green"],
      ["ref4", "图4", "green"],
      ["ref5", "图5", "green"],
      ["prompt", "提示词", "orange"],
    ],
    outputs: [["text", "文本输出", "orange"]],
  },
  "custom-image": {
    icon: "🎨",
    title: "图像生成（自定义）",
    badge: "自定义 API",
    className: "image-node",
    inputs: [
      ["ref1", "图1", "green"],
      ["ref2", "图2", "green"],
      ["prompt", "提示词", "orange"],
    ],
    outputs: [["image", "图片输出", "green"]],
  },
  "custom-chat": {
    icon: "💬",
    title: "智能对话（自定义）",
    badge: "自定义 API",
    className: "chat-node",
    inputs: [
      ["ref1", "图1", "green"],
      ["prompt", "提示词", "orange"],
    ],
    outputs: [["text", "文本输出", "orange"]],
  },
  "text-card": {
    icon: "📝",
    title: "文本卡片",
    badge: "文本",
    className: "note-node",
    inputs: [["text-in", "输入", "orange"]],
    outputs: [["text", "文本输出", "orange"]],
  },
  "multiline-text": {
    icon: "📋",
    title: "多行文本",
    badge: "文本",
    className: "note-node",
    inputs: [["text-in", "输入", "orange"]],
    outputs: [
      ["line1", "组 1", "orange"],
      ["line2", "组 2", "orange"],
      ["line3", "组 3", "orange"],
      ["line4", "组 4", "orange"],
    ],
  },
  "reference-image": {
    icon: "🖼",
    title: "加载参考图",
    badge: "图片",
    className: "image-loader-node",
    inputs: [],
    outputs: [["image", "图片输出", "green"]],
  },
  "logic-switch": {
    icon: "🔀",
    title: "逻辑开关",
    badge: "工具",
    className: "utility-node",
    inputs: [
      ["a", "输入 A", "orange"],
      ["b", "输入 B", "orange"],
    ],
    outputs: [["result", "输出", "orange"]],
  },
  "resize-image": {
    icon: "📐",
    title: "缩放图片",
    badge: "工具",
    className: "utility-node",
    inputs: [["image", "图片输入", "green"]],
    outputs: [["image", "图片输出", "green"]],
  },
  preview: {
    icon: "👁",
    title: "万能预览",
    badge: "其他",
    className: "preview-node",
    inputs: [["any", "任意输入", "purple"]],
    outputs: [],
  },
};

function uid(prefix = "node") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setMode(mode) {
  const isDesktop = mode === "desktop";
  modeChooser.classList.add("hidden");
  desktopMode.classList.toggle("active", isDesktop);
  mobileMode.classList.toggle("active", !isDesktop);
  if (isDesktop) {
    requestAnimationFrame(() => {
      resizeCanvas();
      renderNodes();
      if (!nodes.length) loadTemplate("image-basic", false);
    });
  }
}

function showModeChooser() {
  desktopMode.classList.remove("active");
  mobileMode.classList.remove("active");
  modeChooser.classList.remove("hidden");
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

startModeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.startMode));
});

showChooserButtons.forEach((button) => {
  button.addEventListener("click", showModeChooser);
});

themeSwitch.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  themeSwitch.setAttribute("aria-pressed", String(isDark));
  localStorage.setItem("drawing_theme", isDark ? "dark" : "light");
  drawConnections();
});

function getWorkflowState() {
  return {
    version: 2,
    camera: { ...camera },
    nodes,
    connections,
    historyItems,
    lineStyle,
  };
}

function applyWorkflowState(state) {
  nodes = structuredClone(state.nodes || []);
  connections = structuredClone(state.connections || []);
  historyItems = structuredClone(state.historyItems || []);
  lineStyle = { ...defaultLineStyle, ...(state.lineStyle || {}) };
  Object.assign(camera, state.camera || { x: 0, y: 0, scale: 1 });
  selectedNodeIds = new Set();
  syncLineStyleControls();
  updateHistoryPanel();
  renderNodes();
}

function saveSnapshot() {
  undoStack.push(JSON.stringify(getWorkflowState()));
  if (undoStack.length > 30) undoStack.shift();
}

function undo() {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  applyWorkflowState(JSON.parse(snapshot));
}

function resizeCanvas() {
  const rect = connectionCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  connectionCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
  connectionCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawConnections();
}

function updateViewportTransform() {
  workflowViewport.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  zoomText.textContent = `${Math.round(camera.scale * 100)}%`;
}

function screenToWorld(clientX, clientY) {
  const rect = desktopMode.getBoundingClientRect();
  return {
    x: (clientX - rect.left - camera.x) / camera.scale,
    y: (clientY - rect.top - camera.y) / camera.scale,
  };
}

function defaultValues(type) {
  if (type === "image-generation") {
    return {
      model: "banana",
      ratio: "auto",
      quality: "2K",
      count: "1",
      system: "固定规则 / 角色设定 / 质量要求...",
      user: "接外部文本卡片，运行时拼接在系统提示词后面",
    };
  }

  if (type === "chat") {
    return {
      model: "gpt-image",
      system: "固定规则 / 角色设定 / 质量要求...",
      user: "接外部文本卡片，运行时拼接在系统提示词后面",
    };
  }

  if (type === "custom-image" || type === "custom-chat") {
    return {
      endpoint: "https://api.example.com/generate",
      model: "自定义模型",
      prompt: "接入你的 API 请求体字段...",
    };
  }

  if (type === "text-card") {
    return { text: "输入提示词或对话内容..." };
  }

  if (type === "multiline-text") {
    return { line1: "组 1：输入文本...", line2: "组 2：输入文本...", line3: "组 3：输入文本...", line4: "组 4：输入文本..." };
  }

  if (type === "reference-image") {
    return { fileName: "", imageData: "" };
  }

  if (type === "logic-switch") {
    return { mode: "全部通过", note: "按条件选择输出的提示词或图片" };
  }

  if (type === "resize-image") {
    return { mode: "等比缩放", scale: "100", width: "1024" };
  }

  return {};
}

function addNode(type, x, y, values = {}, shouldSnapshot = true) {
  if (!nodeTypes[type]) return;
  if (shouldSnapshot) saveSnapshot();
  const node = {
    id: uid(type),
    type,
    x,
    y,
    pinned: false,
    values: { ...defaultValues(type), ...values },
  };
  nodes.push(node);
  selectedNodeIds = new Set([node.id]);
  renderNodes();
}

function renderNodes() {
  updateViewportTransform();
  workflowViewport.innerHTML = nodes.map(renderNode).join("");
  bindNodeEvents();
  syncSelection();
  requestAnimationFrame(drawConnections);
}

function renderNode(node) {
  const config = nodeTypes[node.type];
  const className = ["node-card", config.className, node.pinned ? "pinned" : "", node.disabled ? "disabled" : ""].join(" ");
  return `
    <article class="${className}" data-node-id="${node.id}" style="left:${node.x}px; top:${node.y}px;">
      ${renderPorts(node, "input", config.inputs)}
      ${renderPorts(node, "output", config.outputs)}
      <header class="node-header">
        <span class="node-title">${config.icon} ${config.title}</span>
        <span class="node-badge">${config.badge}</span>
      </header>
      <div class="node-body">
        ${renderNodeBody(node)}
      </div>
    </article>
  `;
}

function renderPorts(node, direction, ports) {
  return ports
    .map(([id, label, color], index) => {
      const top = direction === "input" ? 58 + index * 27 : 94 + index * 36;
      const pending = pendingConnection?.nodeId === node.id && pendingConnection?.portId === id ? " pending" : "";
      return `<button class="port ${direction} ${color}${pending}" type="button" title="${label}" style="top:${top}px" data-node-id="${node.id}" data-port-id="${id}" data-port-dir="${direction}" data-port-color="${color}"></button>`;
    })
    .join("");
}

function renderNodeBody(node) {
  const value = node.values || {};

  if (node.type === "image-generation") {
    return `
      <div class="field-row">
        <label>模型</label>
        <select class="node-field" data-field="model">
          <option value="banana" ${value.model === "banana" ? "selected" : ""}>香蕉模型</option>
          <option value="gpt-image" ${value.model === "gpt-image" ? "selected" : ""}>GPT 模型</option>
        </select>
      </div>
      <div class="split-row">
        <div class="field-row">
          <label>图片比例</label>
          <select class="node-field" data-field="ratio">
            <option ${value.ratio === "auto" ? "selected" : ""}>auto</option>
            <option ${value.ratio === "1:1" ? "selected" : ""}>1:1</option>
            <option ${value.ratio === "16:9" ? "selected" : ""}>16:9</option>
            <option ${value.ratio === "9:16" ? "selected" : ""}>9:16</option>
          </select>
        </div>
        <div class="field-row">
          <label>画质</label>
          <select class="node-field" data-field="quality">
            <option ${value.quality === "2K" ? "selected" : ""}>2K</option>
            <option ${value.quality === "4K" ? "selected" : ""}>4K</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <label>出图数量</label>
        <select class="node-field" data-field="count">
          <option ${value.count === "1" ? "selected" : ""}>1</option>
          <option ${value.count === "2" ? "selected" : ""}>2</option>
          <option ${value.count === "4" ? "selected" : ""}>4</option>
          <option ${value.count === "8" ? "selected" : ""}>8</option>
        </select>
      </div>
      <div class="field-row">
        <label>系统提示词</label>
        <textarea class="node-field" data-field="system">${escapeHtml(value.system)}</textarea>
      </div>
      <div class="field-row">
        <label>用户提示词</label>
        <textarea class="node-field" data-field="user">${escapeHtml(value.user)}</textarea>
      </div>
    `;
  }

  if (node.type === "chat") {
    return `
      <div class="field-row">
        <label>模型</label>
        <select class="node-field" data-field="model">
          <option value="gpt-image" ${value.model === "gpt-image" ? "selected" : ""}>GPT 模型</option>
          <option value="banana" ${value.model === "banana" ? "selected" : ""}>香蕉模型</option>
        </select>
      </div>
      <div class="field-row">
        <label>系统提示词</label>
        <textarea class="node-field" data-field="system">${escapeHtml(value.system)}</textarea>
      </div>
      <div class="field-row">
        <label>用户提示词</label>
        <textarea class="node-field" data-field="user">${escapeHtml(value.user)}</textarea>
      </div>
    `;
  }

  if (node.type === "custom-image" || node.type === "custom-chat") {
    return `
      <div class="field-row">
        <label>API 地址</label>
        <input class="node-field" data-field="endpoint" value="${escapeHtml(value.endpoint)}" />
      </div>
      <div class="field-row">
        <label>模型名</label>
        <input class="node-field" data-field="model" value="${escapeHtml(value.model)}" />
      </div>
      <div class="field-row">
        <label>请求说明</label>
        <textarea class="node-field" data-field="prompt">${escapeHtml(value.prompt)}</textarea>
      </div>
    `;
  }

  if (node.type === "text-card") {
    return `
      <textarea class="node-field" data-field="text">${escapeHtml(value.text)}</textarea>
      <button class="mini-button" type="button" data-node-command="clear-text">清空卡片</button>
    `;
  }

  if (node.type === "multiline-text") {
    return `
      <button class="mini-button" type="button" data-node-command="add-line">+ 增加组</button>
      <textarea class="node-field" data-field="line1">${escapeHtml(value.line1)}</textarea>
      <textarea class="node-field" data-field="line2">${escapeHtml(value.line2)}</textarea>
      <textarea class="node-field" data-field="line3">${escapeHtml(value.line3)}</textarea>
      <textarea class="node-field" data-field="line4">${escapeHtml(value.line4)}</textarea>
    `;
  }

  if (node.type === "reference-image") {
    const label = value.fileName ? `已载入：${escapeHtml(value.fileName)}` : "点击上方上传，或将图片拖拽至此框内";
    return `
      <input class="node-file" type="file" accept="image/*" />
      <div class="drop-zone">${label}</div>
    `;
  }

  if (node.type === "logic-switch") {
    return `
      <div class="field-row">
        <label>模式</label>
        <select class="node-field" data-field="mode">
          <option ${value.mode === "全部通过" ? "selected" : ""}>全部通过</option>
          <option ${value.mode === "仅 A" ? "selected" : ""}>仅 A</option>
          <option ${value.mode === "仅 B" ? "selected" : ""}>仅 B</option>
        </select>
      </div>
      <textarea class="node-field" data-field="note">${escapeHtml(value.note)}</textarea>
    `;
  }

  if (node.type === "resize-image") {
    return `
      <div class="field-row">
        <label>缩放模式</label>
        <select class="node-field" data-field="mode">
          <option ${value.mode === "等比缩放" ? "selected" : ""}>等比缩放</option>
          <option ${value.mode === "固定宽度" ? "selected" : ""}>固定宽度</option>
        </select>
      </div>
      <div class="field-row">
        <label>缩放比例 ${escapeHtml(value.scale)}%</label>
        <input class="node-field" data-field="scale" type="range" min="10" max="200" value="${escapeHtml(value.scale)}" />
      </div>
      <div class="preview-box">连接上游图片后预览</div>
    `;
  }

  return `<div class="preview-box">连接并运行...</div>`;
}

function bindNodeEvents() {
  workflowViewport.querySelectorAll(".node-card").forEach((card) => {
    card.addEventListener("pointerdown", (event) => {
      const nodeId = card.dataset.nodeId;
      selectedNodeIds = new Set([nodeId]);
      syncSelection();
      if (event.target.closest("input, textarea, select, button.port, button.mini-button")) return;
      if (!event.target.closest(".node-header")) return;
      const node = nodes.find((item) => item.id === nodeId);
      if (!node || node.pinned) return;
      event.preventDefault();
      saveSnapshot();
      dragState = {
        nodeId,
        startX: event.clientX,
        startY: event.clientY,
        nodeX: node.x,
        nodeY: node.y,
      };
      closeMenus();
    });

    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeNodeMenuId = card.dataset.nodeId;
      selectedNodeIds = new Set([activeNodeMenuId]);
      syncSelection();
      showFloatingMenu(nodeMenu, event.clientX, event.clientY);
      contextMenu.classList.add("hidden");
    });
  });

  workflowViewport.querySelectorAll(".port").forEach((port) => {
    port.addEventListener("click", (event) => {
      event.stopPropagation();
      handlePortClick(port);
    });
  });

  workflowViewport.querySelectorAll(".node-field").forEach((field) => {
    field.addEventListener("input", () => {
      const node = nodes.find((item) => item.id === field.closest(".node-card").dataset.nodeId);
      if (!node) return;
      node.values[field.dataset.field] = field.value;
    });
  });

  workflowViewport.querySelectorAll("[data-node-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const node = nodes.find((item) => item.id === button.closest(".node-card").dataset.nodeId);
      if (!node) return;
      saveSnapshot();
      if (button.dataset.nodeCommand === "clear-text") node.values.text = "";
      if (button.dataset.nodeCommand === "add-line") node.values.line4 = `${node.values.line4 || ""}\n新的一组文本...`;
      renderNodes();
    });
  });

  workflowViewport.querySelectorAll(".node-file").forEach((input) => {
    input.addEventListener("change", async () => {
      const node = nodes.find((item) => item.id === input.closest(".node-card").dataset.nodeId);
      const file = input.files?.[0];
      if (!node || !file) return;
      saveSnapshot();
      node.values.fileName = file.name;
      node.values.imageData = await fileToDataUrl(file);
      renderNodes();
    });
  });
}

function syncSelection() {
  workflowViewport.querySelectorAll(".node-card").forEach((card) => {
    card.classList.toggle("selected", selectedNodeIds.has(card.dataset.nodeId));
  });
}

function handlePortClick(port) {
  const portData = {
    nodeId: port.dataset.nodeId,
    portId: port.dataset.portId,
    dir: port.dataset.portDir,
    color: port.dataset.portColor,
  };

  if (portData.dir === "output") {
    pendingConnection = portData;
    renderNodes();
    return;
  }

  if (!pendingConnection || pendingConnection.nodeId === portData.nodeId) {
    pendingConnection = null;
    renderNodes();
    return;
  }

  saveSnapshot();
  connections.push({
    id: uid("link"),
    from: { nodeId: pendingConnection.nodeId, portId: pendingConnection.portId },
    to: { nodeId: portData.nodeId, portId: portData.portId },
    color: pendingConnection.color,
  });
  pendingConnection = null;
  renderNodes();
}

function getPortCenter(nodeId, portId) {
  const port = workflowViewport.querySelector(`.port[data-node-id="${nodeId}"][data-port-id="${portId}"]`);
  if (!port) return null;
  const rect = port.getBoundingClientRect();
  const canvasRect = connectionCanvas.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - canvasRect.left,
    y: rect.top + rect.height / 2 - canvasRect.top,
  };
}

function drawConnections() {
  const rect = connectionCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  connections.forEach((connection) => {
    const from = getPortCenter(connection.from.nodeId, connection.from.portId);
    const to = getPortCenter(connection.to.nodeId, connection.to.portId);
    if (!from || !to) return;
    drawConnector(from, to, resolveLineColor(connection.color));
  });

  if (pendingConnection && pointerPosition) {
    const from = getPortCenter(pendingConnection.nodeId, pendingConnection.portId);
    if (from) drawConnector(from, pointerPosition, resolveLineColor(pendingConnection.color), true);
  }
}

function getPortLineColor(color) {
  if (color === "green") return "#16c28a";
  if (color === "purple") return "#8b5cf6";
  return "#c45a00";
}

function resolveLineColor(portColor) {
  if (lineStyle.colorMode === "custom") return lineStyle.customColor;
  if (lineStyle.colorMode === "green") return "#16c28a";
  if (lineStyle.colorMode === "orange") return "#c45a00";
  if (lineStyle.colorMode === "purple") return "#8b5cf6";
  if (lineStyle.colorMode === "blue") return "#ffffff";
  return getPortLineColor(portColor);
}

function applyLinePattern(isPreview) {
  if (lineStyle.pattern === "dashed" || isPreview) {
    ctx.setLineDash([12, 9]);
    return;
  }

  if (lineStyle.pattern === "dotted") {
    ctx.setLineDash([2, 10]);
  }
}

function drawConnector(from, to, color, isPreview = false) {
  const distance = Math.max(70, Math.abs(to.x - from.x) * 0.45);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Number(lineStyle.width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  applyLinePattern(isPreview);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  if (lineStyle.type === "straight") {
    ctx.lineTo(to.x, to.y);
  } else if (lineStyle.type === "elbow") {
    const middleX = from.x + (to.x - from.x) / 2;
    ctx.lineTo(middleX, from.y);
    ctx.lineTo(middleX, to.y);
    ctx.lineTo(to.x, to.y);
  } else {
    ctx.bezierCurveTo(from.x + distance, from.y, to.x - distance, to.y, to.x, to.y);
  }

  ctx.stroke();
  ctx.restore();
}

function showFloatingMenu(menu, clientX, clientY) {
  const rect = desktopMode.getBoundingClientRect();
  menu.style.left = `${Math.min(clientX - rect.left, rect.width - 286)}px`;
  menu.style.top = `${Math.min(clientY - rect.top, rect.height - 420)}px`;
  menu.classList.remove("hidden");
}

function closeMenus() {
  contextMenu.classList.add("hidden");
  nodeMenu.classList.add("hidden");
}

desktopMode.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".node-card") || event.target.closest(".info-panel")) return;
  event.preventDefault();
  contextWorldPosition = screenToWorld(event.clientX, event.clientY);
  showFloatingMenu(contextMenu, event.clientX, event.clientY);
  nodeMenu.classList.add("hidden");
});

desktopMode.addEventListener("pointermove", (event) => {
  const rect = connectionCanvas.getBoundingClientRect();
  pointerPosition = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (pendingConnection) drawConnections();
});

contextMenu.querySelectorAll("[data-node-type]").forEach((button) => {
  button.addEventListener("click", () => {
    addNode(button.dataset.nodeType, contextWorldPosition.x, contextWorldPosition.y);
    closeMenus();
  });
});

nodeMenu.querySelectorAll("[data-node-action]").forEach((button) => {
  button.addEventListener("click", () => {
    handleNodeAction(button.dataset.nodeAction);
    closeMenus();
  });
});

function handleNodeAction(action) {
  const node = nodes.find((item) => item.id === activeNodeMenuId);
  if (!node) return;
  saveSnapshot();

  if (action === "pin") {
    node.pinned = !node.pinned;
  }

  if (action === "disable") {
    node.disabled = !node.disabled;
  }

  if (action === "duplicate") {
    const copy = structuredClone(node);
    copy.id = uid(node.type);
    copy.x += 32;
    copy.y += 32;
    copy.pinned = false;
    nodes.push(copy);
    selectedNodeIds = new Set([copy.id]);
  }

  if (action === "delete") {
    deleteNodes([node.id]);
    return;
  }

  renderNodes();
}

function deleteNodes(ids, shouldSnapshot = false) {
  if (shouldSnapshot) saveSnapshot();
  const idSet = new Set(ids);
  nodes = nodes.filter((node) => !idSet.has(node.id));
  connections = connections.filter((connection) => !idSet.has(connection.from.nodeId) && !idSet.has(connection.to.nodeId));
  selectedNodeIds.clear();
  renderNodes();
}

connectionCanvas.addEventListener("pointerdown", (event) => {
  closeMenus();
  selectedNodeIds.clear();
  syncSelection();

  if (event.button === 1 || event.shiftKey || event.altKey || spacePressed) {
    event.preventDefault();
    panState = {
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
  }
});

let spacePressed = false;

window.addEventListener("keydown", (event) => {
  const isEditingField = document.activeElement?.matches?.("input, textarea, select");
  if (isEditingField && event.key !== "Escape") return;

  if (event.code === "Space") {
    spacePressed = true;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    copySelectedNodes();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    event.preventDefault();
    pasteNodes();
  }

  if (event.key === "Delete" && selectedNodeIds.size) {
    deleteNodes([...selectedNodeIds], true);
  }

  if (event.key === "Escape") {
    pendingConnection = null;
    closeMenus();
    renderNodes();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") spacePressed = false;
});

window.addEventListener("pointermove", (event) => {
  if (dragState) {
    const node = nodes.find((item) => item.id === dragState.nodeId);
    if (!node) return;
    node.x = dragState.nodeX + (event.clientX - dragState.startX) / camera.scale;
    node.y = dragState.nodeY + (event.clientY - dragState.startY) / camera.scale;
    const card = workflowViewport.querySelector(`[data-node-id="${node.id}"]`);
    if (card) {
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;
    }
    drawConnections();
  }

  if (panState) {
    camera.x = panState.cameraX + event.clientX - panState.startX;
    camera.y = panState.cameraY + event.clientY - panState.startY;
    updateViewportTransform();
    drawConnections();
  }
});

window.addEventListener("pointerup", () => {
  if (dragState) saveWorkflowQuietly();
  dragState = null;
  panState = null;
});

desktopMode.addEventListener(
  "wheel",
  (event) => {
    if (event.target.closest("textarea, input, select, .info-panel")) return;
    event.preventDefault();
    const rect = desktopMode.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const before = {
      x: (mouseX - camera.x) / camera.scale,
      y: (mouseY - camera.y) / camera.scale,
    };
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    camera.scale = Math.min(2.4, Math.max(0.32, camera.scale * factor));
    camera.x = mouseX - before.x * camera.scale;
    camera.y = mouseY - before.y * camera.scale;
    updateViewportTransform();
    drawConnections();
  },
  { passive: false },
);

function copySelectedNodes() {
  const ids = [...selectedNodeIds];
  if (!ids.length) return;
  const idSet = new Set(ids);
  copiedGraph = {
    nodes: structuredClone(nodes.filter((node) => idSet.has(node.id))),
    connections: structuredClone(connections.filter((connection) => idSet.has(connection.from.nodeId) && idSet.has(connection.to.nodeId))),
  };
}

function pasteNodes() {
  if (!copiedGraph?.nodes?.length) return;
  saveSnapshot();
  const idMap = new Map();
  const pasted = copiedGraph.nodes.map((node) => {
    const next = structuredClone(node);
    next.id = uid(node.type);
    next.x += 40;
    next.y += 40;
    next.pinned = false;
    idMap.set(node.id, next.id);
    return next;
  });
  const pastedConnections = copiedGraph.connections.map((connection) => ({
    ...structuredClone(connection),
    id: uid("link"),
    from: { ...connection.from, nodeId: idMap.get(connection.from.nodeId) },
    to: { ...connection.to, nodeId: idMap.get(connection.to.nodeId) },
  }));
  nodes.push(...pasted);
  connections.push(...pastedConnections);
  selectedNodeIds = new Set(pasted.map((node) => node.id));
  renderNodes();
}

document.getElementById("guideButton").addEventListener("click", () => {
  guidePanel.classList.toggle("hidden");
  templatePanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
  lineStylePanel.classList.add("hidden");
});

document.getElementById("tutorialButton").addEventListener("click", () => {
  guidePanel.classList.remove("hidden");
  templatePanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
  lineStylePanel.classList.add("hidden");
});

document.getElementById("templateButton").addEventListener("click", () => {
  templatePanel.classList.toggle("hidden");
  guidePanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
  lineStylePanel.classList.add("hidden");
});

document.getElementById("historyButton").addEventListener("click", () => {
  historyPanel.classList.toggle("hidden");
  guidePanel.classList.add("hidden");
  templatePanel.classList.add("hidden");
  lineStylePanel.classList.add("hidden");
});

document.getElementById("lineStyleButton").addEventListener("click", () => {
  lineStylePanel.classList.toggle("hidden");
  guidePanel.classList.add("hidden");
  templatePanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
});

function syncLineStyleControls() {
  lineColorMode.value = lineStyle.colorMode;
  lineCustomColor.value = lineStyle.customColor;
  lineType.value = lineStyle.type;
  linePattern.value = lineStyle.pattern;
  lineWidth.value = String(lineStyle.width);
  lineWidthValue.textContent = `${lineStyle.width}px`;
}

function updateLineStyleFromControls() {
  lineStyle = {
    colorMode: lineColorMode.value,
    customColor: lineCustomColor.value,
    type: lineType.value,
    pattern: linePattern.value,
    width: Number(lineWidth.value),
  };
  lineWidthValue.textContent = `${lineStyle.width}px`;
  drawConnections();
  saveWorkflowQuietly();
}

[lineColorMode, lineCustomColor, lineType, linePattern, lineWidth].forEach((control) => {
  control.addEventListener("input", updateLineStyleFromControls);
  control.addEventListener("change", updateLineStyleFromControls);
});

document.querySelectorAll("[data-close-panel]").forEach((button) => {
  button.addEventListener("click", () => button.closest(".info-panel").classList.add("hidden"));
});

document.querySelectorAll("[data-template]").forEach((button) => {
  button.addEventListener("click", () => {
    loadTemplate(button.dataset.template);
    templatePanel.classList.add("hidden");
  });
});

function loadTemplate(name, shouldSnapshot = true) {
  if (shouldSnapshot) saveSnapshot();
  selectedNodeIds.clear();
  if (name === "all") {
    loadAllTemplate();
  } else if (name === "reference") {
    loadReferenceTemplate();
  } else if (name === "chat") {
    loadChatTemplate();
  } else {
    loadImageBasicTemplate();
  }
  renderNodes();
}

function setTemplate(nodesInput, linksInput, nextCamera = { x: 260, y: 70, scale: 0.88 }) {
  nodes = nodesInput.map((node) => ({
    pinned: false,
    values: defaultValues(node.type),
    ...node,
    values: { ...defaultValues(node.type), ...(node.values || {}) },
  }));
  connections = linksInput.map((link) => ({ id: uid("link"), ...link }));
  Object.assign(camera, nextCamera);
}

function loadImageBasicTemplate() {
  setTemplate(
    [
      { id: "text-1", type: "text-card", x: 0, y: 80, values: { text: "一只未来感机械花，蓝色霓虹，电影感光影" } },
      { id: "image-1", type: "image-generation", x: 360, y: 20 },
      { id: "preview-1", type: "preview", x: 720, y: 86 },
    ],
    [
      { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
      { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
    ],
  );
}

function loadReferenceTemplate() {
  setTemplate(
    [
      { id: "ref-1", type: "reference-image", x: 0, y: 60 },
      { id: "resize-1", type: "resize-image", x: 340, y: 60 },
      { id: "text-1", type: "text-card", x: 340, y: 330, values: { text: "保留参考图构图，改成高级产品摄影风格" } },
      { id: "image-1", type: "image-generation", x: 700, y: 70 },
      { id: "preview-1", type: "preview", x: 1060, y: 118 },
    ],
    [
      { from: { nodeId: "ref-1", portId: "image" }, to: { nodeId: "resize-1", portId: "image" }, color: "green" },
      { from: { nodeId: "resize-1", portId: "image" }, to: { nodeId: "image-1", portId: "ref1" }, color: "green" },
      { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
      { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
    ],
  );
}

function loadChatTemplate() {
  setTemplate(
    [
      { id: "text-1", type: "text-card", x: 0, y: 80, values: { text: "把这段想法扩写成稳定出图提示词" } },
      { id: "chat-1", type: "chat", x: 340, y: 20 },
      { id: "image-1", type: "image-generation", x: 700, y: 20 },
      { id: "preview-1", type: "preview", x: 1060, y: 86 },
    ],
    [
      { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "chat-1", portId: "prompt" }, color: "orange" },
      { from: { nodeId: "chat-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
      { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
    ],
  );
}

function loadAllTemplate() {
  setTemplate(
    [
      { id: "chat-a", type: "chat", x: 0, y: 0 },
      { id: "preview-a", type: "preview", x: 420, y: 60 },
      { id: "image-a", type: "image-generation", x: 0, y: 430 },
      { id: "preview-b", type: "preview", x: 470, y: 500 },
      { id: "text-a", type: "text-card", x: 920, y: 250, values: { text: "输入提示词或对话内容..." } },
      { id: "multi-a", type: "multiline-text", x: 260, y: 1040 },
      { id: "preview-c", type: "preview", x: 650, y: 1080 },
      { id: "ref-a", type: "reference-image", x: 1180, y: 330 },
      { id: "ref-b", type: "reference-image", x: 1180, y: 650 },
      { id: "image-b", type: "image-generation", x: 1530, y: 0 },
      { id: "chat-b", type: "chat", x: 1880, y: 80 },
      { id: "image-c", type: "image-generation", x: 1530, y: 610 },
      { id: "chat-c", type: "chat", x: 1880, y: 630 },
      { id: "ref-c", type: "reference-image", x: 1080, y: 1100 },
      { id: "resize-a", type: "resize-image", x: 1440, y: 1080 },
      { id: "preview-d", type: "preview", x: 1780, y: 1110 },
      { id: "custom-a", type: "custom-image", x: 720, y: 720 },
      { id: "logic-a", type: "logic-switch", x: 720, y: 930 },
    ],
    [
      { from: { nodeId: "chat-a", portId: "text" }, to: { nodeId: "preview-a", portId: "any" }, color: "orange" },
      { from: { nodeId: "image-a", portId: "image" }, to: { nodeId: "preview-b", portId: "any" }, color: "green" },
      { from: { nodeId: "text-a", portId: "text" }, to: { nodeId: "image-b", portId: "user" }, color: "orange" },
      { from: { nodeId: "ref-a", portId: "image" }, to: { nodeId: "image-b", portId: "ref1" }, color: "green" },
      { from: { nodeId: "image-b", portId: "image" }, to: { nodeId: "chat-b", portId: "ref1" }, color: "green" },
      { from: { nodeId: "ref-b", portId: "image" }, to: { nodeId: "image-c", portId: "ref1" }, color: "green" },
      { from: { nodeId: "image-c", portId: "image" }, to: { nodeId: "chat-c", portId: "ref1" }, color: "green" },
      { from: { nodeId: "multi-a", portId: "line1" }, to: { nodeId: "preview-c", portId: "any" }, color: "orange" },
      { from: { nodeId: "ref-c", portId: "image" }, to: { nodeId: "resize-a", portId: "image" }, color: "green" },
      { from: { nodeId: "resize-a", portId: "image" }, to: { nodeId: "preview-d", portId: "any" }, color: "green" },
    ],
    { x: 230, y: 40, scale: 0.62 },
  );
}

function exportWorkflow() {
  const link = document.createElement("a");
  const blob = new Blob([JSON.stringify(getWorkflowState(), null, 2)], { type: "application/json" });
  link.download = `workflow-${Date.now()}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

document.getElementById("exportButton").addEventListener("click", exportWorkflow);
document.getElementById("saveButton").addEventListener("click", () => {
  localStorage.setItem("drawing_workflow", JSON.stringify(getWorkflowState()));
  alert("工作流已保存到本地浏览器。");
});

function saveWorkflowQuietly() {
  localStorage.setItem("drawing_workflow", JSON.stringify(getWorkflowState()));
}

document.getElementById("importButton").addEventListener("click", () => workflowFile.click());
workflowFile.addEventListener("change", async () => {
  const file = workflowFile.files?.[0];
  if (!file) return;
  saveSnapshot();
  applyWorkflowState(JSON.parse(await file.text()));
});

document.getElementById("runButton").addEventListener("click", () => {
  historyItems.unshift({
    time: new Date().toLocaleString(),
    nodes: nodes.length,
    connections: connections.length,
  });
  historyItems = historyItems.slice(0, 12);
  updateHistoryPanel();
  saveWorkflowQuietly();
  alert(`已检查 ${nodes.length} 个节点和 ${connections.length} 条连线。接入真实 API 后这里会按工作流顺序执行。`);
});

document.getElementById("stopButton").addEventListener("click", () => {
  alert("已停止当前工作流。");
});

function updateHistoryPanel() {
  if (!historyItems.length) {
    historyList.innerHTML = "<p>运行工作流后会在这里记录。</p>";
    return;
  }
  historyList.innerHTML = historyItems
    .map((item) => `<div class="history-item">${escapeHtml(item.time)} · ${item.nodes} 个节点 · ${item.connections} 条连线</div>`)
    .join("");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

referenceInput.addEventListener("change", async () => {
  const file = referenceInput.files?.[0];
  if (!file) return;

  referenceDataUrl = await fileToDataUrl(file);
  referencePreview.src = referenceDataUrl;
  uploadZone.classList.add("has-image");
  document.getElementById("uploadText").textContent = "更换参考图";
});

function buildPayload() {
  return {
    model: modelSelect.value,
    prompt: promptInput.value.trim(),
    referenceImage: referenceDataUrl || null,
    size: "1024x1024",
  };
}

function saveApiSettings() {
  localStorage.setItem("drawing_api_endpoint", apiEndpoint.value.trim());
  localStorage.setItem("drawing_api_key", apiKey.value.trim());
}

function loadApiSettings() {
  apiEndpoint.value = localStorage.getItem("drawing_api_endpoint") || "";
  apiKey.value = localStorage.getItem("drawing_api_key") || "";
}

apiEndpoint.addEventListener("change", saveApiSettings);
apiKey.addEventListener("change", saveApiSettings);

async function generateImage() {
  const endpoint = apiEndpoint.value.trim();
  const key = apiKey.value.trim();
  lastPayload = buildPayload();

  if (!lastPayload.prompt) {
    generateStatus.textContent = "请先输入提示词。";
    promptInput.focus();
    return;
  }

  if (!["banana", "gpt-image"].includes(lastPayload.model)) {
    generateStatus.textContent = "当前只允许使用香蕉模型和 GPT 模型。";
    return;
  }

  if (!endpoint) {
    generateStatus.textContent = "请在 API 接入设置里填写接口地址。";
    return;
  }

  generateButton.disabled = true;
  generateStatus.textContent = `正在调用${modelSelect.selectedOptions[0].textContent}...`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(lastPayload),
    });

    if (!response.ok) {
      throw new Error(`接口返回 ${response.status}`);
    }

    const data = await response.json();
    resultDataUrl = data.imageUrl || data.url || data.data?.[0]?.url || data.data?.[0]?.b64_json;

    if (resultDataUrl && !resultDataUrl.startsWith("http") && !resultDataUrl.startsWith("data:")) {
      resultDataUrl = `data:image/png;base64,${resultDataUrl}`;
    }

    if (!resultDataUrl) {
      throw new Error("响应中没有找到 imageUrl、url 或 b64_json");
    }

    resultBox.innerHTML = "";
    const image = document.createElement("img");
    image.src = resultDataUrl;
    image.alt = "生成结果";
    resultBox.appendChild(image);
    downloadResultButton.disabled = false;
    generateStatus.textContent = "生成完成。";
  } catch (error) {
    generateStatus.textContent = `生成失败：${error.message}`;
  } finally {
    generateButton.disabled = false;
  }
}

generateButton.addEventListener("click", generateImage);

downloadResultButton.addEventListener("click", () => {
  if (!resultDataUrl) return;
  const link = document.createElement("a");
  link.download = `generated-${Date.now()}.png`;
  link.href = resultDataUrl;
  link.click();
});

copyPayloadButton.addEventListener("click", async () => {
  lastPayload = buildPayload();
  await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2));
  generateStatus.textContent = "请求参数已复制。";
});

function restoreLocalState() {
  if (localStorage.getItem("drawing_theme") === "dark") {
    document.body.classList.add("dark");
    themeSwitch.setAttribute("aria-pressed", "true");
  }

  const savedWorkflow = localStorage.getItem("drawing_workflow");
  if (savedWorkflow) {
    try {
      applyWorkflowState(JSON.parse(savedWorkflow));
    } catch {
      localStorage.removeItem("drawing_workflow");
    }
  }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".context-menu")) closeMenus();
});

window.addEventListener("resize", resizeCanvas);
loadApiSettings();
restoreLocalState();
syncLineStyleControls();
updateHistoryPanel();
const initialMode = new URLSearchParams(window.location.search).get("mode");
if (["desktop", "mobile"].includes(initialMode)) {
  setMode(initialMode);
} else {
  showModeChooser();
}
