"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "chooser" | "desktop" | "mobile";
type PortDirection = "input" | "output";
type PortColor = "green" | "orange" | "purple";
type NodeType =
  | "image-generation"
  | "chat"
  | "custom-image"
  | "custom-chat"
  | "text-card"
  | "multiline-text"
  | "reference-image"
  | "logic-switch"
  | "resize-image"
  | "preview";

type LineColorMode = "by-port" | "green" | "orange" | "purple" | "blue" | "custom";
type LineType = "curve" | "straight" | "elbow";
type LinePattern = "solid" | "dashed" | "dotted";
type PanelKey = "guide" | "template" | "history" | "line" | "settings";
type SettingsTab = "directory" | "chat" | "image" | "mobile" | "polling" | "custom";

interface PortDef {
  id: string;
  label: string;
  color: PortColor;
}

interface NodeConfig {
  icon: string;
  title: string;
  badge: string;
  widthClass: string;
  inputs: PortDef[];
  outputs: PortDef[];
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  pinned?: boolean;
  disabled?: boolean;
  values: Record<string, string>;
}

interface PortRefData {
  nodeId: string;
  portId: string;
}

interface Connection {
  id: string;
  from: PortRefData;
  to: PortRefData;
  color: PortColor;
}

interface PendingConnection extends PortRefData {
  color: PortColor;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface LineStyle {
  colorMode: LineColorMode;
  customColor: string;
  type: LineType;
  pattern: LinePattern;
  width: number;
}

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface AppSettings {
  imageDirectory: string;
  chatApi: ApiConfig;
  imageApi: ApiConfig;
  mobileApi: ApiConfig;
  polling: {
    enabled: boolean;
    intervalSeconds: string;
    timeoutSeconds: string;
    maxAttempts: string;
  };
  customApi: ApiConfig & {
    method: string;
    headers: string;
    bodyTemplate: string;
  };
}

interface WorkflowState {
  version: number;
  camera: Camera;
  nodes: WorkflowNode[];
  connections: Connection[];
  historyItems: HistoryItem[];
  lineStyle: LineStyle;
}

interface HistoryItem {
  time: string;
  nodes: number;
  connections: number;
}

interface FloatingMenu {
  visible: boolean;
  x: number;
  y: number;
}

interface CanvasMenu extends FloatingMenu {
  worldX: number;
  worldY: number;
}

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  nodeX: number;
  nodeY: number;
}

interface PanState {
  startX: number;
  startY: number;
  cameraX: number;
  cameraY: number;
}

const BRAND = "#c45a00";
const BRAND_DARK = "#9f4300";
const GREEN = "#16c28a";
const PURPLE = "#8b5cf6";

const defaultCamera: Camera = { x: 260, y: 70, scale: 0.88 };
const allTemplateCamera: Camera = { x: 230, y: 40, scale: 0.62 };
const defaultLineStyle: LineStyle = {
  colorMode: "orange",
  customColor: BRAND,
  type: "curve",
  pattern: "solid",
  width: 4,
};

const CHAT_MODEL_OPTIONS: ModelOption[] = [
  { value: "openai-gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { value: "anthropic-claude-opus-4.1", label: "Claude Opus 4.1", provider: "Anthropic" },
  { value: "google-gemini-3-pro", label: "Gemini 3 Pro", provider: "Google" },
  { value: "xai-grok-4-fast", label: "Grok 4 Fast", provider: "xAI" },
  { value: "deepseek-v3.2", label: "DeepSeek-V3.2", provider: "DeepSeek" },
  { value: "alibaba-qwen3-max", label: "Qwen3-Max", provider: "Alibaba" },
  { value: "moonshot-kimi-k2", label: "Kimi K2", provider: "Moonshot" },
  { value: "meta-llama-4-maverick", label: "Llama 4 Maverick", provider: "Meta" },
  { value: "mistral-large-3", label: "Mistral Large 3", provider: "Mistral AI" },
  { value: "cohere-command-a-reasoning", label: "Command A Reasoning", provider: "Cohere" },
];

const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  { value: "nano-banana-2", label: "Nano Banana 2", provider: "Google" },
  { value: "gpt-image-2", label: "GPT Image 2", provider: "OpenAI" },
  { value: "google-gemini-3-pro-image", label: "Gemini 3 Pro Image", provider: "Google" },
  { value: "midjourney-v7", label: "Midjourney V7", provider: "Midjourney" },
  { value: "adobe-firefly-image-4", label: "Firefly Image 4", provider: "Adobe" },
  { value: "bfl-flux-kontext-pro", label: "FLUX.1 Kontext Pro", provider: "Black Forest Labs" },
  { value: "stability-sd-3.5-large", label: "Stable Diffusion 3.5 Large", provider: "Stability AI" },
  { value: "alibaba-qwen-image", label: "Qwen-Image", provider: "Alibaba" },
  { value: "bytedance-seedream-4", label: "Seedream 4.0", provider: "ByteDance" },
  { value: "ideogram-v3", label: "Ideogram V3", provider: "Ideogram" },
];

const MOBILE_IMAGE_MODEL_OPTIONS: ModelOption[] = [
  { value: "nano-banana-2", label: "Nano Banana 2 / 香蕉模型 2", provider: "Google" },
  { value: "gpt-image-2", label: "GPT Image 2 / GPT 模型", provider: "OpenAI" },
];

const defaultAppSettings: AppSettings = {
  imageDirectory: "",
  chatApi: {
    endpoint: "",
    apiKey: "",
    model: CHAT_MODEL_OPTIONS[0].value,
  },
  imageApi: {
    endpoint: "",
    apiKey: "",
    model: IMAGE_MODEL_OPTIONS[0].value,
  },
  mobileApi: {
    endpoint: "",
    apiKey: "",
    model: MOBILE_IMAGE_MODEL_OPTIONS[1].value,
  },
  polling: {
    enabled: true,
    intervalSeconds: "2",
    timeoutSeconds: "120",
    maxAttempts: "60",
  },
  customApi: {
    endpoint: "https://api.example.com/v1/generate",
    apiKey: "",
    model: "custom-model",
    method: "POST",
    headers: "{\n  \"Content-Type\": \"application/json\"\n}",
    bodyTemplate: "{\n  \"model\": \"{{model}}\",\n  \"prompt\": \"{{prompt}}\",\n  \"images\": {{images}}\n}",
  },
};

const nodeConfigs: Record<NodeType, NodeConfig> = {
  "image-generation": {
    icon: "🎨",
    title: "图像生成",
    badge: "AI 模型",
    widthClass: "w-[282px]",
    inputs: [
      { id: "ref1", label: "图1", color: "green" },
      { id: "ref2", label: "图2", color: "green" },
      { id: "ref3", label: "图3", color: "green" },
      { id: "ref4", label: "图4", color: "green" },
      { id: "ref5", label: "图5", color: "green" },
      { id: "system", label: "系统提示词", color: "orange" },
      { id: "user", label: "用户提示词", color: "orange" },
    ],
    outputs: [{ id: "image", label: "图片输出", color: "green" }],
  },
  chat: {
    icon: "💬",
    title: "智能对话",
    badge: "AI 模型",
    widthClass: "w-[282px]",
    inputs: [
      { id: "ref1", label: "图1", color: "green" },
      { id: "ref2", label: "图2", color: "green" },
      { id: "ref3", label: "图3", color: "green" },
      { id: "ref4", label: "图4", color: "green" },
      { id: "ref5", label: "图5", color: "green" },
      { id: "prompt", label: "提示词", color: "orange" },
    ],
    outputs: [{ id: "text", label: "文本输出", color: "orange" }],
  },
  "custom-image": {
    icon: "🎨",
    title: "图像生成（自定义）",
    badge: "自定义 API",
    widthClass: "w-[282px]",
    inputs: [
      { id: "ref1", label: "图1", color: "green" },
      { id: "ref2", label: "图2", color: "green" },
      { id: "prompt", label: "提示词", color: "orange" },
    ],
    outputs: [{ id: "image", label: "图片输出", color: "green" }],
  },
  "custom-chat": {
    icon: "💬",
    title: "智能对话（自定义）",
    badge: "自定义 API",
    widthClass: "w-[282px]",
    inputs: [
      { id: "ref1", label: "图1", color: "green" },
      { id: "prompt", label: "提示词", color: "orange" },
    ],
    outputs: [{ id: "text", label: "文本输出", color: "orange" }],
  },
  "text-card": {
    icon: "📝",
    title: "文本卡片",
    badge: "文本",
    widthClass: "w-[246px]",
    inputs: [{ id: "text-in", label: "输入", color: "orange" }],
    outputs: [{ id: "text", label: "文本输出", color: "orange" }],
  },
  "multiline-text": {
    icon: "📋",
    title: "多行文本",
    badge: "文本",
    widthClass: "w-[246px]",
    inputs: [{ id: "text-in", label: "输入", color: "orange" }],
    outputs: [
      { id: "line1", label: "组 1", color: "orange" },
      { id: "line2", label: "组 2", color: "orange" },
      { id: "line3", label: "组 3", color: "orange" },
      { id: "line4", label: "组 4", color: "orange" },
    ],
  },
  "reference-image": {
    icon: "🖼",
    title: "加载参考图",
    badge: "图片",
    widthClass: "w-[282px]",
    inputs: [],
    outputs: [{ id: "image", label: "图片输出", color: "green" }],
  },
  "logic-switch": {
    icon: "🔀",
    title: "逻辑开关",
    badge: "工具",
    widthClass: "w-[260px]",
    inputs: [
      { id: "a", label: "输入 A", color: "orange" },
      { id: "b", label: "输入 B", color: "orange" },
    ],
    outputs: [{ id: "result", label: "输出", color: "orange" }],
  },
  "resize-image": {
    icon: "📐",
    title: "缩放图片",
    badge: "工具",
    widthClass: "w-[260px]",
    inputs: [{ id: "image", label: "图片输入", color: "green" }],
    outputs: [{ id: "image", label: "图片输出", color: "green" }],
  },
  preview: {
    icon: "👁",
    title: "万能预览",
    badge: "其他",
    widthClass: "w-[282px]",
    inputs: [{ id: "any", label: "任意输入", color: "purple" }],
    outputs: [],
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeModelValue(value: string, options: ModelOption[], fallback: string) {
  if (value === "banana") return "nano-banana-2";
  if (value === "gpt-image") return "gpt-image-2";
  return options.some((model) => model.value === value) ? value : fallback;
}

function mergeAppSettings(value: Partial<AppSettings> = {}): AppSettings {
  const merged = {
    ...defaultAppSettings,
    ...value,
    chatApi: { ...defaultAppSettings.chatApi, ...(value.chatApi ?? {}) },
    imageApi: { ...defaultAppSettings.imageApi, ...(value.imageApi ?? {}) },
    mobileApi: { ...defaultAppSettings.mobileApi, ...(value.mobileApi ?? {}) },
    polling: { ...defaultAppSettings.polling, ...(value.polling ?? {}) },
    customApi: { ...defaultAppSettings.customApi, ...(value.customApi ?? {}) },
  };
  return {
    ...merged,
    imageApi: {
      ...merged.imageApi,
      model: normalizeModelValue(merged.imageApi.model, IMAGE_MODEL_OPTIONS, defaultAppSettings.imageApi.model),
    },
    mobileApi: {
      ...merged.mobileApi,
      model: normalizeModelValue(merged.mobileApi.model, MOBILE_IMAGE_MODEL_OPTIONS, defaultAppSettings.mobileApi.model),
    },
  };
}

function modelDisplayName(models: ModelOption[], value: string) {
  const match = models.find((model) => model.value === value);
  return match ? `${match.provider} · ${match.label}` : value;
}

function normalizeImageEndpoint(endpoint: string) {
  const value = endpoint.trim();
  if (!value) return value;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "/v1") {
      url.pathname = "/v1/images/generations";
      return url.toString();
    }
  } catch {
    return value;
  }
  return value;
}

function apiAuthHeader(apiKey: string): Record<string, string> {
  const key = apiKey.trim().replace(/^["']|["']$/g, "");
  if (!key) return {};
  return { Authorization: /^Bearer\s+/i.test(key) ? key : `Bearer ${key}` };
}

async function downloadImageFile(src: string, filename = `generated-${Date.now()}.png`) {
  const save = (href: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = href;
    link.click();
  };

  if (!src.startsWith("http")) {
    save(src);
    return;
  }

  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    save(url);
    URL.revokeObjectURL(url);
  } catch {
    save(src);
  }
}

async function readJsonResponse(response: Response) {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const detail = body.trim().slice(0, 180);
    throw new Error(`接口返回 ${response.status}${detail ? `：${detail}` : ""}`);
  }
  if (!contentType.includes("application/json") && body.trim().startsWith("<")) {
    throw new Error("接口返回了网页内容，请把接口地址改为 /v1/images/generations 结尾。");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("接口响应不是有效 JSON，请检查 API 地址或服务返回格式。");
  }
}

function extractImageUrl(data: unknown) {
  const value = data as {
    imageUrl?: string;
    url?: string;
    b64_json?: string;
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const imageUrl = value.imageUrl || value.url || value.b64_json || value.data?.[0]?.url || value.data?.[0]?.b64_json;
  if (!imageUrl) return "";
  const text = String(imageUrl);
  return text.startsWith("http") || text.startsWith("data:") ? text : `data:image/png;base64,${text}`;
}

function imageSizeForRatio(ratio: string) {
  if (ratio === "16:9") return "1536x864";
  if (ratio === "9:16") return "864x1536";
  return "1024x1024";
}

function uid(prefix = "node") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultValues(type: NodeType): Record<string, string> {
  if (type === "image-generation") {
    return {
      model: "nano-banana-2",
      ratio: "auto",
      quality: "2K",
      count: "1",
      system: "固定规则 / 角色设定 / 质量要求...",
      user: "接外部文本卡片，运行时拼接在系统提示词后面",
    };
  }
  if (type === "chat") {
    return {
      model: CHAT_MODEL_OPTIONS[0].value,
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
  if (type === "text-card") return { text: "输入提示词或对话内容..." };
  if (type === "multiline-text") {
    return {
      line1: "组 1：输入文本...",
      line2: "组 2：输入文本...",
      line3: "组 3：输入文本...",
      line4: "组 4：输入文本...",
    };
  }
  if (type === "reference-image") return { fileName: "", imageData: "" };
  if (type === "logic-switch") return { mode: "全部通过", note: "按条件选择输出的提示词或图片" };
  if (type === "resize-image") return { mode: "等比缩放", scale: "100", width: "1024" };
  return {};
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeNode(type: NodeType, x: number, y: number, values: Record<string, string> = {}): WorkflowNode {
  return {
    id: uid(type),
    type,
    x,
    y,
    pinned: false,
    values: { ...defaultValues(type), ...values },
  };
}

export default function Workbench() {
  const [mode, setMode] = useState<Mode>("chooser");
  const [dark, setDark] = useState(false);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [camera, setCamera] = useState<Camera>(defaultCamera);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [lineStyle, setLineStyle] = useState<LineStyle>(defaultLineStyle);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasMenu>({ visible: false, x: 0, y: 0, worldX: 0, worldY: 0 });
  const [nodeMenu, setNodeMenu] = useState<FloatingMenu>({ visible: false, x: 0, y: 0 });
  const [activeNodeMenuId, setActiveNodeMenuId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [referenceDataUrl, setReferenceDataUrl] = useState("");
  const [resultDataUrl, setResultDataUrl] = useState("");
  const [imageViewer, setImageViewer] = useState<{ src: string; title: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generateStatus, setGenerateStatus] = useState("手机模式使用独立的手机生图 API，可选 Nano Banana 2 或 GPT Image 2。");
  const [workflowStatus, setWorkflowStatus] = useState("右键添加节点，拖拽连线，滚轮缩放");
  const [isGenerating, setIsGenerating] = useState(false);

  const desktopRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const portRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const spacePressedRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const copiedGraphRef = useRef<{ nodes: WorkflowNode[]; connections: Connection[] } | null>(null);
  const suppressNextPortClickRef = useRef(false);
  const workflowFileRef = useRef<HTMLInputElement | null>(null);

  const dotBackground = useMemo(
    () => ({
      backgroundColor: dark ? "#1b120c" : "#ffffff",
      backgroundImage: `radial-gradient(circle, ${dark ? "#5a2d13" : "#efc9ad"} 1.7px, transparent 1.8px)`,
      backgroundSize: "36px 36px",
    }),
    [dark],
  );

  const getWorkflowState = useCallback((): WorkflowState => {
    return {
      version: 3,
      camera,
      nodes,
      connections,
      historyItems,
      lineStyle,
    };
  }, [camera, connections, historyItems, lineStyle, nodes]);

  const saveSnapshot = useCallback(() => {
    undoStackRef.current.push(JSON.stringify(getWorkflowState()));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
  }, [getWorkflowState]);

  const saveWorkflowQuietly = useCallback(() => {
    localStorage.setItem("drawing_workflow", JSON.stringify(getWorkflowState()));
  }, [getWorkflowState]);

  const applyWorkflowState = useCallback((state: Partial<WorkflowState>) => {
    setNodes(state.nodes ?? []);
    setConnections(state.connections ?? []);
    setHistoryItems(state.historyItems ?? []);
    setLineStyle({ ...defaultLineStyle, ...(state.lineStyle ?? {}) });
    setCamera(state.camera ?? defaultCamera);
    setSelectedNodeIds(new Set());
  }, []);

  const loadTemplate = useCallback(
    (name: "all" | "image-basic" | "reference" | "chat", shouldSnapshot = true) => {
      if (shouldSnapshot) saveSnapshot();
      const setTemplate = (templateNodes: WorkflowNode[], links: Omit<Connection, "id">[], nextCamera = defaultCamera) => {
        setNodes(templateNodes);
        setConnections(links.map((link) => ({ ...link, id: uid("link") })));
        setCamera(nextCamera);
        setSelectedNodeIds(new Set());
      };

      if (name === "reference") {
        setTemplate(
          [
            { ...makeNode("reference-image", 0, 60), id: "ref-1" },
            { ...makeNode("resize-image", 340, 60), id: "resize-1" },
            { ...makeNode("text-card", 340, 330, { text: "保留参考图构图，改成高级产品摄影风格" }), id: "text-1" },
            { ...makeNode("image-generation", 700, 70), id: "image-1" },
            { ...makeNode("preview", 1060, 118), id: "preview-1" },
          ],
          [
            { from: { nodeId: "ref-1", portId: "image" }, to: { nodeId: "resize-1", portId: "image" }, color: "green" },
            { from: { nodeId: "resize-1", portId: "image" }, to: { nodeId: "image-1", portId: "ref1" }, color: "green" },
            { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
            { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
          ],
        );
        return;
      }

      if (name === "chat") {
        setTemplate(
          [
            { ...makeNode("text-card", 0, 80, { text: "把这段想法扩写成稳定出图提示词" }), id: "text-1" },
            { ...makeNode("chat", 340, 20), id: "chat-1" },
            { ...makeNode("image-generation", 700, 20), id: "image-1" },
            { ...makeNode("preview", 1060, 86), id: "preview-1" },
          ],
          [
            { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "chat-1", portId: "prompt" }, color: "orange" },
            { from: { nodeId: "chat-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
            { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
          ],
        );
        return;
      }

      if (name === "all") {
        setTemplate(
          [
            { ...makeNode("chat", 0, 0), id: "chat-a" },
            { ...makeNode("preview", 420, 60), id: "preview-a" },
            { ...makeNode("image-generation", 0, 430), id: "image-a" },
            { ...makeNode("preview", 470, 500), id: "preview-b" },
            { ...makeNode("text-card", 920, 250), id: "text-a" },
            { ...makeNode("multiline-text", 260, 1040), id: "multi-a" },
            { ...makeNode("preview", 650, 1080), id: "preview-c" },
            { ...makeNode("reference-image", 1180, 330), id: "ref-a" },
            { ...makeNode("reference-image", 1180, 650), id: "ref-b" },
            { ...makeNode("image-generation", 1530, 0), id: "image-b" },
            { ...makeNode("chat", 1880, 80), id: "chat-b" },
            { ...makeNode("image-generation", 1530, 610), id: "image-c" },
            { ...makeNode("chat", 1880, 630), id: "chat-c" },
            { ...makeNode("reference-image", 1080, 1100), id: "ref-c" },
            { ...makeNode("resize-image", 1440, 1080), id: "resize-a" },
            { ...makeNode("preview", 1780, 1110), id: "preview-d" },
            { ...makeNode("custom-image", 720, 720), id: "custom-a" },
            { ...makeNode("logic-switch", 720, 930), id: "logic-a" },
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
          allTemplateCamera,
        );
        return;
      }

      setTemplate(
        [
          { ...makeNode("text-card", 0, 80, { text: "一只未来感机械花，蓝色霓虹，电影感光影" }), id: "text-1" },
          { ...makeNode("image-generation", 360, 20), id: "image-1" },
          { ...makeNode("preview", 720, 86), id: "preview-1" },
        ],
        [
          { from: { nodeId: "text-1", portId: "text" }, to: { nodeId: "image-1", portId: "user" }, color: "orange" },
          { from: { nodeId: "image-1", portId: "image" }, to: { nodeId: "preview-1", portId: "any" }, color: "green" },
        ],
      );
    },
    [saveSnapshot],
  );

  const openMode = useCallback(
    (nextMode: Exclude<Mode, "chooser">) => {
      setMode(nextMode);
      if (nextMode === "desktop" && nodes.length === 0) loadTemplate("image-basic", false);
    },
    [loadTemplate, nodes.length],
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem("drawing_theme");
    if (storedTheme === "dark") setDark(true);

    const legacyEndpoint = localStorage.getItem("drawing_api_endpoint") || "";
    const legacyApiKey = localStorage.getItem("drawing_api_key") || "";
    const savedSettings = localStorage.getItem("drawing_app_settings");
    let nextSettings = defaultAppSettings;
    if (savedSettings) {
      try {
        nextSettings = mergeAppSettings(JSON.parse(savedSettings) as Partial<AppSettings>);
      } catch {
        localStorage.removeItem("drawing_app_settings");
      }
    }
    if (legacyEndpoint && !nextSettings.imageApi.endpoint) nextSettings = { ...nextSettings, imageApi: { ...nextSettings.imageApi, endpoint: legacyEndpoint } };
    if (legacyApiKey && !nextSettings.imageApi.apiKey) nextSettings = { ...nextSettings, imageApi: { ...nextSettings.imageApi, apiKey: legacyApiKey } };
    if (legacyEndpoint && !nextSettings.mobileApi.endpoint) nextSettings = { ...nextSettings, mobileApi: { ...nextSettings.mobileApi, endpoint: legacyEndpoint } };
    if (legacyApiKey && !nextSettings.mobileApi.apiKey) nextSettings = { ...nextSettings, mobileApi: { ...nextSettings.mobileApi, apiKey: legacyApiKey } };
    setAppSettings(nextSettings);

    const savedWorkflow = localStorage.getItem("drawing_workflow");
    if (savedWorkflow) {
      try {
        applyWorkflowState(JSON.parse(savedWorkflow) as Partial<WorkflowState>);
      } catch {
        localStorage.removeItem("drawing_workflow");
      }
    }

    const initialMode = new URLSearchParams(window.location.search).get("mode");
    if (initialMode === "desktop" || initialMode === "mobile") {
      setMode(initialMode);
    }
  }, [applyWorkflowState]);

  useEffect(() => {
    if (mode === "desktop" && nodes.length === 0) loadTemplate("image-basic", false);
  }, [loadTemplate, mode, nodes.length]);

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext("2d");
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []);

  const resolveLineColor = useCallback(
    (portColor: PortColor) => {
      if (lineStyle.colorMode === "custom") return lineStyle.customColor;
      if (lineStyle.colorMode === "green") return GREEN;
      if (lineStyle.colorMode === "orange") return BRAND;
      if (lineStyle.colorMode === "purple") return PURPLE;
      if (lineStyle.colorMode === "blue") return "#ffffff";
      if (portColor === "green") return GREEN;
      if (portColor === "purple") return PURPLE;
      return BRAND;
    },
    [lineStyle],
  );

  const getPortCenter = useCallback((nodeId: string, portId: string, direction: PortDirection) => {
    const port = portRefs.current[`${nodeId}:${portId}:${direction}`];
    const canvas = canvasRef.current;
    if (!port || !canvas) return null;
    const rect = port.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - canvasRect.left,
      y: rect.top + rect.height / 2 - canvasRect.top,
    };
  }, []);

  const drawConnector = useCallback(
    (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, preview = false) => {
      const distance = Math.max(70, Math.abs(to.x - from.x) * 0.45);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineStyle.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (preview || lineStyle.pattern === "dashed") ctx.setLineDash([12, 9]);
      if (lineStyle.pattern === "dotted") ctx.setLineDash([2, 10]);
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
    },
    [lineStyle],
  );

  const drawConnections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);

    connections.forEach((connection) => {
      const from = getPortCenter(connection.from.nodeId, connection.from.portId, "output");
      const to = getPortCenter(connection.to.nodeId, connection.to.portId, "input");
      if (!from || !to) return;
      drawConnector(context, from, to, resolveLineColor(connection.color));
    });

    if (pendingConnection && pointerPosition) {
      const from = getPortCenter(pendingConnection.nodeId, pendingConnection.portId, "output");
      if (from) drawConnector(context, from, pointerPosition, resolveLineColor(pendingConnection.color), true);
    }
  }, [connections, drawConnector, getPortCenter, pendingConnection, pointerPosition, resolveLineColor]);

  useEffect(() => {
    updateCanvasSize();
    const frame = requestAnimationFrame(drawConnections);
    return () => cancelAnimationFrame(frame);
  }, [camera, drawConnections, mode, nodes, updateCanvasSize]);

  useEffect(() => {
    const onResize = () => {
      updateCanvasSize();
      requestAnimationFrame(drawConnections);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawConnections, updateCanvasSize]);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = desktopRef.current?.getBoundingClientRect();
      return {
        x: (clientX - (rect?.left ?? 0) - camera.x) / camera.scale,
        y: (clientY - (rect?.top ?? 0) - camera.y) / camera.scale,
      };
    },
    [camera],
  );

  const closeMenus = useCallback(() => {
    setContextMenu((menu) => ({ ...menu, visible: false }));
    setNodeMenu((menu) => ({ ...menu, visible: false }));
  }, []);

  const addNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      saveSnapshot();
      const node = makeNode(type, x, y);
      setNodes((current) => [...current, node]);
      setSelectedNodeIds(new Set([node.id]));
    },
    [saveSnapshot],
  );

  const deleteNodes = useCallback(
    (ids: string[], snapshot = false) => {
      if (snapshot) saveSnapshot();
      const idSet = new Set(ids);
      setNodes((current) => current.filter((node) => !idSet.has(node.id)));
      setConnections((current) => current.filter((connection) => !idSet.has(connection.from.nodeId) && !idSet.has(connection.to.nodeId)));
      setSelectedNodeIds(new Set());
    },
    [saveSnapshot],
  );

  const connectPorts = useCallback(
    (from: PendingConnection, to: PortRefData) => {
      if (from.nodeId === to.nodeId) return false;
      saveSnapshot();
      setConnections((current) => {
        const withoutDuplicateTarget = current.filter((connection) => !(connection.to.nodeId === to.nodeId && connection.to.portId === to.portId));
        return [
          ...withoutDuplicateTarget,
          {
            id: uid("link"),
            from: { nodeId: from.nodeId, portId: from.portId },
            to: { nodeId: to.nodeId, portId: to.portId },
            color: from.color,
          },
        ];
      });
      setWorkflowStatus("已连接节点，运行工作流即可生成。");
      return true;
    },
    [saveSnapshot],
  );

  const handlePortPointerDown = useCallback((nodeId: string, portId: string, direction: PortDirection, color: PortColor, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    if (direction !== "output") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    setPendingConnection({ nodeId, portId, color });
  }, [closeMenus]);

  const handlePortClick = useCallback(
    (nodeId: string, portId: string, direction: PortDirection, color: PortColor) => {
      if (suppressNextPortClickRef.current) {
        suppressNextPortClickRef.current = false;
        return;
      }
      if (direction === "output") {
        setPendingConnection({ nodeId, portId, color });
        return;
      }

      if (!pendingConnection || pendingConnection.nodeId === nodeId) {
        setPendingConnection(null);
        return;
      }

      connectPorts(pendingConnection, { nodeId, portId });
      setPendingConnection(null);
      setPointerPosition(null);
    },
    [connectPorts, pendingConnection],
  );

  const setNodeValue = useCallback((nodeId: string, field: string, value: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              values: { ...node.values, [field]: value },
            }
          : node,
      ),
    );
  }, []);

  const copySelectedNodes = useCallback(() => {
    const ids = [...selectedNodeIds];
    if (!ids.length) return;
    const idSet = new Set(ids);
    copiedGraphRef.current = {
      nodes: structuredClone(nodes.filter((node) => idSet.has(node.id))),
      connections: structuredClone(connections.filter((connection) => idSet.has(connection.from.nodeId) && idSet.has(connection.to.nodeId))),
    };
  }, [connections, nodes, selectedNodeIds]);

  const pasteNodes = useCallback(() => {
    const graph = copiedGraphRef.current;
    if (!graph?.nodes.length) return;
    saveSnapshot();
    const idMap = new Map<string, string>();
    const pasted = graph.nodes.map((node) => {
      const next = structuredClone(node);
      next.id = uid(node.type);
      next.x += 40;
      next.y += 40;
      next.pinned = false;
      idMap.set(node.id, next.id);
      return next;
    });
    const pastedConnections = graph.connections.map((connection) => ({
      ...structuredClone(connection),
      id: uid("link"),
      from: { ...connection.from, nodeId: idMap.get(connection.from.nodeId) ?? connection.from.nodeId },
      to: { ...connection.to, nodeId: idMap.get(connection.to.nodeId) ?? connection.to.nodeId },
    }));
    setNodes((current) => [...current, ...pasted]);
    setConnections((current) => [...current, ...pastedConnections]);
    setSelectedNodeIds(new Set(pasted.map((node) => node.id)));
  }, [saveSnapshot]);

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    applyWorkflowState(JSON.parse(snapshot) as Partial<WorkflowState>);
  }, [applyWorkflowState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") && event.key !== "Escape") return;

      if (event.code === "Space") spacePressedRef.current = true;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") copySelectedNodes();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteNodes();
      }
      if (event.key === "Delete" && selectedNodeIds.size) deleteNodes([...selectedNodeIds], true);
      if (event.key === "Escape") {
        setPendingConnection(null);
        closeMenus();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [closeMenus, copySelectedNodes, deleteNodes, pasteNodes, selectedNodeIds, undo]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (pendingConnection) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }
      if (dragRef.current) {
        const drag = dragRef.current;
        setNodes((current) =>
          current.map((node) =>
            node.id === drag.nodeId
              ? {
                  ...node,
                  x: drag.nodeX + (event.clientX - drag.startX) / camera.scale,
                  y: drag.nodeY + (event.clientY - drag.startY) / camera.scale,
                }
              : node,
          ),
        );
      }
      if (panRef.current) {
        const pan = panRef.current;
        setCamera((current) => ({
          ...current,
          x: pan.cameraX + event.clientX - pan.startX,
          y: pan.cameraY + event.clientY - pan.startY,
        }));
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pendingConnection) {
        const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const port = target?.closest<HTMLButtonElement>("[data-port-direction='input']");
        const nodeId = port?.dataset.nodeId;
        const portId = port?.dataset.portId;
        if (nodeId && portId) {
          const connected = connectPorts(pendingConnection, { nodeId, portId });
          if (connected) suppressNextPortClickRef.current = true;
        }
        setPendingConnection(null);
        setPointerPosition(null);
      }
      if (dragRef.current) saveWorkflowQuietly();
      dragRef.current = null;
      panRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [camera.scale, connectPorts, pendingConnection, saveWorkflowQuietly]);

  const exportWorkflow = useCallback(() => {
    const link = document.createElement("a");
    const blob = new Blob([JSON.stringify(getWorkflowState(), null, 2)], { type: "application/json" });
    link.download = `workflow-${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [getWorkflowState]);

  const importWorkflow = useCallback(async (file: File) => {
    saveSnapshot();
    applyWorkflowState(JSON.parse(await file.text()) as Partial<WorkflowState>);
  }, [applyWorkflowState, saveSnapshot]);

  const runWorkflow = useCallback(async () => {
    const enabledNodes = nodes.filter((node) => !node.disabled);
    const imageNodes = enabledNodes.filter((node) => node.type === "image-generation");
    const imageApi = appSettings.imageApi.endpoint.trim() ? appSettings.imageApi : appSettings.mobileApi;
    if (!imageNodes.length) {
      setWorkflowStatus("当前工作流里没有可运行的图像生成节点。");
      return;
    }
    if (!imageApi.endpoint.trim()) {
      setWorkflowStatus("请先在系统设置的图像 API 或手机 API 里填写接口地址和密钥。");
      setActivePanel("settings");
      return;
    }

    const nodeById = new Map(enabledNodes.map((node) => [node.id, node]));
    const outputValue = (node: WorkflowNode, portId: string) => {
      if (node.type === "text-card") return node.values.text || "";
      if (node.type === "multiline-text") return node.values[portId] || "";
      if (node.type === "reference-image") return node.values.imageData || "";
      if (node.type === "preview") return node.values.imageData || node.values.text || "";
      if (node.type === "resize-image") return node.values.imageData || "";
      if (node.type === "image-generation") return node.values.imageData || "";
      if (node.type === "chat") return node.values.user || "";
      if (node.type === "logic-switch") return node.values.note || "";
      return "";
    };
    const incomingValues = (nodeId: string, portIds: string[]) =>
      connections
        .filter((connection) => connection.to.nodeId === nodeId && portIds.includes(connection.to.portId))
        .map((connection) => {
          const fromNode = nodeById.get(connection.from.nodeId);
          return fromNode ? outputValue(fromNode, connection.from.portId).trim() : "";
        })
        .filter(Boolean);

    setIsGenerating(true);
    setWorkflowStatus(`正在运行 ${imageNodes.length} 个图像生成节点...`);
    try {
      let generatedCount = 0;
      const nodeUpdates = new Map<string, Record<string, string>>();
      for (const imageNode of imageNodes) {
        const promptParts = [
          imageNode.values.system,
          ...incomingValues(imageNode.id, ["system"]),
          imageNode.values.user,
          ...incomingValues(imageNode.id, ["user"]),
        ].map((value) => value.trim()).filter(Boolean);
        const promptText = promptParts.join("\n\n");
        if (!promptText) throw new Error(`节点「${nodeConfigs[imageNode.type].title}」缺少提示词。`);

        const referenceImage = incomingValues(imageNode.id, ["ref1", "ref2", "ref3", "ref4", "ref5"]).find((value) => value.startsWith("data:image/"));
        const payload = {
          model: imageNode.values.model || imageApi.model,
          prompt: promptText,
          size: imageSizeForRatio(imageNode.values.ratio),
          n: Number(imageNode.values.count || "1"),
          ...(referenceImage ? { referenceImage } : {}),
        };
        const response = await fetch(normalizeImageEndpoint(imageApi.endpoint), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...apiAuthHeader(imageApi.apiKey),
          },
          body: JSON.stringify(payload),
        });
        const data = await readJsonResponse(response);
        const imageUrl = extractImageUrl(data);
        if (!imageUrl) throw new Error("响应中没有找到 imageUrl、url 或 b64_json");
        nodeUpdates.set(imageNode.id, { imageData: imageUrl, status: "生成完成" });
        connections
          .filter((connection) => connection.from.nodeId === imageNode.id && connection.from.portId === "image")
          .forEach((connection) => {
            nodeUpdates.set(connection.to.nodeId, { imageData: imageUrl, text: "生成完成" });
          });
        setResultDataUrl(imageUrl);
        generatedCount += 1;
      }

      setNodes((current) =>
        current.map((node) => {
          const patch = nodeUpdates.get(node.id);
          return patch ? { ...node, values: { ...node.values, ...patch } } : node;
        }),
      );
      setHistoryItems((current) => [{ time: new Date().toLocaleString(), nodes: nodes.length, connections: connections.length }, ...current].slice(0, 12));
      saveWorkflowQuietly();
      setWorkflowStatus(`工作流运行完成，已生成 ${generatedCount} 张图片。`);
    } catch (error) {
      setWorkflowStatus(`工作流运行失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsGenerating(false);
    }
  }, [appSettings.imageApi, appSettings.mobileApi, connections, nodes, saveWorkflowQuietly]);

  const currentMobileModel = appSettings.mobileApi.model;

  const buildMobilePayload = useCallback(() => {
    return {
      model: appSettings.mobileApi.model,
      prompt: prompt.trim(),
      referenceImage: referenceDataUrl || null,
      size: "1024x1024",
    };
  }, [appSettings.mobileApi.model, prompt, referenceDataUrl]);

  const generateImage = useCallback(async () => {
    const payload = buildMobilePayload();
    if (!payload.prompt) {
      setGenerateStatus("请先输入提示词。");
      return;
    }
    if (!MOBILE_IMAGE_MODEL_OPTIONS.some((model) => model.value === payload.model)) {
      setGenerateStatus("手机模式当前只允许使用 Nano Banana 2 或 GPT Image 2。");
      return;
    }
    const mobileApi = appSettings.mobileApi;
    if (!mobileApi.endpoint.trim()) {
      setGenerateStatus("请先填写手机模式的 API 接口地址。");
      return;
    }

    setIsGenerating(true);
    setGenerateStatus(`正在调用${modelDisplayName(MOBILE_IMAGE_MODEL_OPTIONS, currentMobileModel)}...`);
    try {
      const response = await fetch(normalizeImageEndpoint(mobileApi.endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiAuthHeader(mobileApi.apiKey),
        },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse(response);
      let imageUrl = data.imageUrl || data.url || data.data?.[0]?.url || data.data?.[0]?.b64_json;
      if (imageUrl && !String(imageUrl).startsWith("http") && !String(imageUrl).startsWith("data:")) imageUrl = `data:image/png;base64,${imageUrl}`;
      if (!imageUrl) throw new Error("响应中没有找到 imageUrl、url 或 b64_json");
      setResultDataUrl(String(imageUrl));
      setGenerateStatus("生成完成。");
    } catch (error) {
      setGenerateStatus(`生成失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsGenerating(false);
    }
  }, [appSettings.mobileApi, buildMobilePayload, currentMobileModel]);

  useEffect(() => {
    localStorage.setItem("drawing_app_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem("drawing_theme", dark ? "dark" : "light");
  }, [dark]);

  const chooseImageDirectory = useCallback(async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker;
    if (!picker) {
      alert("当前浏览器不支持目录选择，请使用 Chrome 或 Edge。");
      return;
    }
    try {
      const directory = await picker.call(window);
      setAppSettings((current) => ({ ...current, imageDirectory: directory.name }));
    } catch {
      // User cancelled the picker.
    }
  }, []);

  return (
    <main className={cn("min-h-screen text-brand-ink", dark && "dark")} onClick={(event) => {
      if (!(event.target as HTMLElement).closest(".context-menu-surface")) closeMenus();
    }}>
      {mode === "chooser" && (
        <section className="fixed inset-0 z-20 grid place-items-center p-6" style={dotBackground} aria-label="选择使用界面">
          <div className="w-full max-w-[680px] rounded-[22px] border-[3px] border-brand bg-white/95 p-8 shadow-orange">
            <p className="mb-2 text-[15px] font-black text-brand-dark">请选择进入界面</p>
            <h1 className="m-0 text-[34px] font-black leading-tight">节点生图工作台</h1>
            <p className="my-3 leading-7 text-brand-muted">电脑界面用于搭建节点工作流，手机界面用于上传参考图、输入提示词并调用生图模型。</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button className="grid min-h-[178px] gap-2 rounded-2xl border-[3px] border-brand/40 bg-white p-5 text-left shadow-orange hover:border-brand-dark" type="button" onClick={() => openMode("desktop")}>
                <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-brand-pale text-3xl">🖥</span>
                <strong className="text-[22px]">电脑界面</strong>
                <small className="text-sm leading-6 text-brand-muted">无限节点画布、右键添加卡片、连线编排生图流程</small>
              </button>
              <button className="grid min-h-[178px] gap-2 rounded-2xl border-[3px] border-brand/40 bg-white p-5 text-left shadow-orange hover:border-brand-dark" type="button" onClick={() => openMode("mobile")}>
                <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-brand-pale text-3xl">📱</span>
                <strong className="text-[22px]">手机界面</strong>
                <small className="text-sm leading-6 text-brand-muted">参考图上传、提示词、生图模型接入</small>
              </button>
            </div>
          </div>
        </section>
      )}

      {mode === "desktop" && (
        <section
          ref={desktopRef}
          className="relative h-screen w-screen overflow-hidden"
          style={dotBackground}
          onContextMenu={(event) => {
            if ((event.target as HTMLElement).closest(".node-card, .info-panel")) return;
            event.preventDefault();
            const rect = desktopRef.current?.getBoundingClientRect();
            const world = screenToWorld(event.clientX, event.clientY);
            setContextMenu({
              visible: true,
              x: Math.min(event.clientX - (rect?.left ?? 0), (rect?.width ?? 0) - 286),
              y: Math.min(event.clientY - (rect?.top ?? 0), (rect?.height ?? 0) - 420),
              worldX: world.x,
              worldY: world.y,
            });
            setNodeMenu((menu) => ({ ...menu, visible: false }));
          }}
          onPointerMove={(event) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          }}
          onWheel={(event) => {
            if ((event.target as HTMLElement).closest("textarea, input, select, .info-panel")) return;
            event.preventDefault();
            const rect = desktopRef.current?.getBoundingClientRect();
            const mouseX = event.clientX - (rect?.left ?? 0);
            const mouseY = event.clientY - (rect?.top ?? 0);
            const before = { x: (mouseX - camera.x) / camera.scale, y: (mouseY - camera.y) / camera.scale };
            const factor = event.deltaY < 0 ? 1.08 : 0.92;
            const nextScale = Math.min(2.4, Math.max(0.32, camera.scale * factor));
            setCamera({ scale: nextScale, x: mouseX - before.x * nextScale, y: mouseY - before.y * nextScale });
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-[1] h-full w-full touch-none"
            onPointerDown={(event) => {
              closeMenus();
              setSelectedNodeIds(new Set());
              if (event.button === 1 || event.shiftKey || event.altKey || spacePressedRef.current) {
                event.preventDefault();
                panRef.current = { startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y };
              }
            }}
          />
          <div className="pointer-events-none absolute inset-0 z-[2] origin-top-left" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selectedNodeIds.has(node.id)}
                pendingConnection={pendingConnection}
                onSelect={() => setSelectedNodeIds(new Set([node.id]))}
                onHeaderPointerDown={(event) => {
                  if (node.pinned) return;
                  event.preventDefault();
                  saveSnapshot();
                  dragRef.current = { nodeId: node.id, startX: event.clientX, startY: event.clientY, nodeX: node.x, nodeY: node.y };
                  closeMenus();
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = desktopRef.current?.getBoundingClientRect();
                  setActiveNodeMenuId(node.id);
                  setSelectedNodeIds(new Set([node.id]));
                  setNodeMenu({ visible: true, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
                  setContextMenu((menu) => ({ ...menu, visible: false }));
                }}
                onPortClick={handlePortClick}
                onPortPointerDown={handlePortPointerDown}
                onFieldChange={setNodeValue}
                onPreviewImage={(src) => setImageViewer({ src, title: "生成结果" })}
                onDownloadImage={(src) => void downloadImageFile(src)}
                onCommand={(command) => {
                  saveSnapshot();
                  if (command === "clear-text") setNodeValue(node.id, "text", "");
                  if (command === "add-line") setNodeValue(node.id, "line4", `${node.values.line4 || ""}\n新的一组文本...`);
                }}
                onFileChange={async (file) => {
                  saveSnapshot();
                  const imageData = await fileToDataUrl(file);
                  setNodes((current) =>
                    current.map((item) =>
                      item.id === node.id ? { ...item, values: { ...item.values, fileName: file.name, imageData } } : item,
                    ),
                  );
                }}
                registerPort={(key, element) => {
                  portRefs.current[key] = element;
                }}
              />
            ))}
          </div>

          <DesktopChrome
            dark={dark}
            camera={camera}
            status={workflowStatus}
            isRunning={isGenerating}
            activePanel={activePanel}
            onToggleDark={() => setDark((value) => !value)}
            onShowChooser={() => setMode("chooser")}
            onShowPanel={setActivePanel}
            onExport={exportWorkflow}
            onImportClick={() => workflowFileRef.current?.click()}
            onSave={() => {
              localStorage.setItem("drawing_workflow", JSON.stringify(getWorkflowState()));
              setWorkflowStatus("工作流已保存到本地浏览器。");
            }}
            onRun={runWorkflow}
            onStop={() => setWorkflowStatus("已停止当前工作流。")}
          />

          {activePanel === "guide" && <GuidePanel onClose={() => setActivePanel(null)} />}
          {activePanel === "template" && <TemplatePanel onClose={() => setActivePanel(null)} onLoad={(template) => loadTemplate(template)} />}
          {activePanel === "history" && <HistoryPanel items={historyItems} onClose={() => setActivePanel(null)} />}
          {activePanel === "line" && <LineStylePanel value={lineStyle} onChange={(next) => { setLineStyle(next); setTimeout(saveWorkflowQuietly); }} onClose={() => setActivePanel(null)} />}
          {activePanel === "settings" && (
            <SettingsPanel
              value={appSettings}
              onChange={setAppSettings}
              onChooseDirectory={chooseImageDirectory}
              onClose={() => setActivePanel(null)}
            />
          )}

          {imageViewer && (
            <ImageViewer
              src={imageViewer.src}
              title={imageViewer.title}
              onClose={() => setImageViewer(null)}
              onDownload={() => void downloadImageFile(imageViewer.src)}
            />
          )}

          {contextMenu.visible && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onAdd={(type) => {
                addNode(type, contextMenu.worldX, contextMenu.worldY);
                closeMenus();
              }}
            />
          )}

          {nodeMenu.visible && (
            <NodeMenu
              x={nodeMenu.x}
              y={nodeMenu.y}
              onAction={(action) => {
                const node = nodes.find((item) => item.id === activeNodeMenuId);
                if (!node) return;
                saveSnapshot();
                if (action === "pin") setNodes((current) => current.map((item) => (item.id === node.id ? { ...item, pinned: !item.pinned } : item)));
                if (action === "disable") setNodes((current) => current.map((item) => (item.id === node.id ? { ...item, disabled: !item.disabled } : item)));
                if (action === "duplicate") {
                  const copy = structuredClone(node);
                  copy.id = uid(node.type);
                  copy.x += 32;
                  copy.y += 32;
                  copy.pinned = false;
                  setNodes((current) => [...current, copy]);
                  setSelectedNodeIds(new Set([copy.id]));
                }
                if (action === "delete") deleteNodes([node.id]);
                closeMenus();
              }}
            />
          )}

          <input
            ref={workflowFileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importWorkflow(file);
            }}
          />
        </section>
      )}

      {mode === "mobile" && (
        <MobileGenerator
          prompt={prompt}
          model={currentMobileModel}
          apiConfig={appSettings.mobileApi}
          status={generateStatus}
          isGenerating={isGenerating}
          referenceDataUrl={referenceDataUrl}
          resultDataUrl={resultDataUrl}
          onShowChooser={() => setMode("chooser")}
          onPromptChange={setPrompt}
          onApiConfigChange={(patch) => setAppSettings((current) => ({ ...current, mobileApi: { ...current.mobileApi, ...patch } }))}
          onGenerate={generateImage}
          onReferenceChange={async (file) => setReferenceDataUrl(await fileToDataUrl(file))}
          onCopyPayload={async () => {
            await navigator.clipboard.writeText(JSON.stringify(buildMobilePayload(), null, 2));
            setGenerateStatus("请求参数已复制。");
          }}
        />
      )}
    </main>
  );
}

function NodeCard({
  node,
  selected,
  pendingConnection,
  onSelect,
  onHeaderPointerDown,
  onContextMenu,
  onPortClick,
  onPortPointerDown,
  onFieldChange,
  onPreviewImage,
  onDownloadImage,
  onCommand,
  onFileChange,
  registerPort,
}: {
  node: WorkflowNode;
  selected: boolean;
  pendingConnection: PendingConnection | null;
  onSelect: () => void;
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onPortClick: (nodeId: string, portId: string, direction: PortDirection, color: PortColor) => void;
  onPortPointerDown: (nodeId: string, portId: string, direction: PortDirection, color: PortColor, event: React.PointerEvent<HTMLButtonElement>) => void;
  onFieldChange: (nodeId: string, field: string, value: string) => void;
  onPreviewImage: (src: string) => void;
  onDownloadImage: (src: string) => void;
  onCommand: (command: string) => void;
  onFileChange: (file: File) => void;
  registerPort: (key: string, element: HTMLButtonElement | null) => void;
}) {
  const config = nodeConfigs[node.type];
  return (
    <article
      className={cn(
        "node-card pointer-events-auto absolute select-none rounded-[14px] border-2 border-brand bg-white/95 text-brand-ink shadow-orange",
        config.widthClass,
        selected && "outline outline-4 outline-brand/35",
        node.pinned && "border-brand-dark",
        node.disabled && "opacity-50 grayscale",
      )}
      style={{ left: node.x, top: node.y }}
      onPointerDown={(event) => {
        onSelect();
        if ((event.target as HTMLElement).closest("input, textarea, select, button")) return;
      }}
      onContextMenu={onContextMenu}
    >
      {config.inputs.map((port, index) => (
        <PortButton
          key={`in-${port.id}`}
          nodeId={node.id}
          port={port}
          direction="input"
          top={58 + index * 27}
          pending={false}
          onPortClick={onPortClick}
          onPortPointerDown={onPortPointerDown}
          registerPort={registerPort}
        />
      ))}
      {config.outputs.map((port, index) => (
        <PortButton
          key={`out-${port.id}`}
          nodeId={node.id}
          port={port}
          direction="output"
          top={94 + index * 36}
          pending={pendingConnection?.nodeId === node.id && pendingConnection.portId === port.id}
          onPortClick={onPortClick}
          onPortPointerDown={onPortPointerDown}
          registerPort={registerPort}
        />
      ))}
      <header className="flex min-h-[42px] cursor-grab items-center justify-between border-b border-dashed border-brand/30 px-3.5 font-black text-brand-dark active:cursor-grabbing" onPointerDown={onHeaderPointerDown}>
        <span className="inline-flex items-center gap-2">
          {config.icon} {config.title}
        </span>
        <span className="text-xs font-extrabold text-brand-muted">{config.badge}</span>
      </header>
      <div className="grid gap-2.5 p-3">{renderNodeBody(node, onFieldChange, onPreviewImage, onDownloadImage, onCommand, onFileChange)}</div>
    </article>
  );
}

function PortButton({
  nodeId,
  port,
  direction,
  top,
  pending,
  onPortClick,
  onPortPointerDown,
  registerPort,
}: {
  nodeId: string;
  port: PortDef;
  direction: PortDirection;
  top: number;
  pending: boolean;
  onPortClick: (nodeId: string, portId: string, direction: PortDirection, color: PortColor) => void;
  onPortPointerDown: (nodeId: string, portId: string, direction: PortDirection, color: PortColor, event: React.PointerEvent<HTMLButtonElement>) => void;
  registerPort: (key: string, element: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={(element) => registerPort(`${nodeId}:${port.id}:${direction}`, element)}
      className={cn(
        "absolute grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
        direction === "input" ? "-left-2" : "-right-2",
        port.color === "green" && "bg-[#16c28a]",
        port.color === "orange" && "bg-brand",
        port.color === "purple" && "bg-[#8b5cf6]",
        pending && "shadow-[0_0_0_5px_rgba(196,90,0,0.35)]",
      )}
      style={{ top }}
      type="button"
      title={port.label}
      data-node-id={nodeId}
      data-port-id={port.id}
      data-port-direction={direction}
      onPointerDown={(event) => onPortPointerDown(nodeId, port.id, direction, port.color, event)}
      onClick={(event) => {
        event.stopPropagation();
        onPortClick(nodeId, port.id, direction, port.color);
      }}
    />
  );
}

function renderNodeBody(
  node: WorkflowNode,
  onFieldChange: (nodeId: string, field: string, value: string) => void,
  onPreviewImage: (src: string) => void,
  onDownloadImage: (src: string) => void,
  onCommand: (command: string) => void,
  onFileChange: (file: File) => void,
) {
  const inputClass = "h-9 w-full rounded-lg border border-brand/30 bg-white/90 px-2 text-brand-ink";
  const textareaClass = "min-h-[54px] w-full resize-y rounded-lg border border-brand/30 bg-white/90 p-2 leading-snug text-brand-ink";
  const labelClass = "text-[11px] font-extrabold text-brand-muted";
  const field = (name: string, value: string, multiline = false) => (
    <div className="grid gap-1.5">
      <label className={labelClass}>{name}</label>
      {multiline ? (
        <textarea className={textareaClass} value={value} onChange={(event) => onFieldChange(node.id, name, event.target.value)} />
      ) : (
        <input className={inputClass} value={value} onChange={(event) => onFieldChange(node.id, name, event.target.value)} />
      )}
    </div>
  );

  if (node.type === "image-generation") {
    return (
      <>
        <div className="grid gap-1.5">
          <label className={labelClass}>模型</label>
          <select className={inputClass} value={node.values.model} onChange={(event) => onFieldChange(node.id, "model", event.target.value)}>
            {IMAGE_MODEL_OPTIONS.map((model) => (
              <option key={model.value} value={model.value}>{model.provider} · {model.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <label className={labelClass}>图片比例</label>
            <select className={inputClass} value={node.values.ratio} onChange={(event) => onFieldChange(node.id, "ratio", event.target.value)}>
              <option value="auto">auto</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass}>画质</label>
            <select className={inputClass} value={node.values.quality} onChange={(event) => onFieldChange(node.id, "quality", event.target.value)}>
              <option>2K</option>
              <option>4K</option>
            </select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass}>出图数量</label>
          <select className={inputClass} value={node.values.count} onChange={(event) => onFieldChange(node.id, "count", event.target.value)}>
            <option>1</option>
            <option>2</option>
            <option>4</option>
            <option>8</option>
          </select>
        </div>
        {field("system", node.values.system, true)}
        {field("user", node.values.user, true)}
        {node.values.imageData && (
          <ImageResultPreview
            src={node.values.imageData}
            alt="生成结果"
            onPreview={() => onPreviewImage(node.values.imageData)}
            onDownload={() => onDownloadImage(node.values.imageData)}
          />
        )}
      </>
    );
  }

  if (node.type === "chat") {
    return (
      <>
        <div className="grid gap-1.5">
          <label className={labelClass}>模型</label>
          <select className={inputClass} value={node.values.model} onChange={(event) => onFieldChange(node.id, "model", event.target.value)}>
            {CHAT_MODEL_OPTIONS.map((model) => (
              <option key={model.value} value={model.value}>{model.provider} · {model.label}</option>
            ))}
          </select>
        </div>
        {field("system", node.values.system, true)}
        {field("user", node.values.user, true)}
      </>
    );
  }

  if (node.type === "custom-image" || node.type === "custom-chat") {
    return (
      <>
        {field("endpoint", node.values.endpoint)}
        {field("model", node.values.model)}
        {field("prompt", node.values.prompt, true)}
      </>
    );
  }

  if (node.type === "text-card") {
    return (
      <>
        <textarea className={textareaClass} value={node.values.text} onChange={(event) => onFieldChange(node.id, "text", event.target.value)} />
        <button className="justify-self-start rounded-md border-2 border-brand px-2.5 py-1 text-xs font-black text-brand-dark" type="button" onClick={() => onCommand("clear-text")}>
          清空卡片
        </button>
      </>
    );
  }

  if (node.type === "multiline-text") {
    return (
      <>
        <button className="justify-self-start rounded-md border-2 border-brand px-2.5 py-1 text-xs font-black text-brand-dark" type="button" onClick={() => onCommand("add-line")}>
          + 增加组
        </button>
        {["line1", "line2", "line3", "line4"].map((line) => (
          <textarea key={line} className={textareaClass} value={node.values[line] || ""} onChange={(event) => onFieldChange(node.id, line, event.target.value)} />
        ))}
      </>
    );
  }

  if (node.type === "reference-image") {
    return (
      <>
        <input className={inputClass} type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onFileChange(event.target.files[0])} />
        <div className="grid min-h-[118px] place-items-center rounded-lg border border-dashed border-brand bg-brand-pale/70 text-center text-xs font-black text-brand-dark">
          {node.values.fileName ? `已载入：${node.values.fileName}` : "点击上方上传，或将图片拖拽至此框内"}
        </div>
      </>
    );
  }

  if (node.type === "logic-switch") {
    return (
      <>
        <select className={inputClass} value={node.values.mode} onChange={(event) => onFieldChange(node.id, "mode", event.target.value)}>
          <option>全部通过</option>
          <option>仅 A</option>
          <option>仅 B</option>
        </select>
        <textarea className={textareaClass} value={node.values.note} onChange={(event) => onFieldChange(node.id, "note", event.target.value)} />
      </>
    );
  }

  if (node.type === "resize-image") {
    return (
      <>
        <select className={inputClass} value={node.values.mode} onChange={(event) => onFieldChange(node.id, "mode", event.target.value)}>
          <option>等比缩放</option>
          <option>固定宽度</option>
        </select>
        <label className={labelClass}>缩放比例 {node.values.scale}%</label>
        <input className="w-full accent-brand" type="range" min="10" max="200" value={node.values.scale} onChange={(event) => onFieldChange(node.id, "scale", event.target.value)} />
        <div className="grid min-h-[148px] place-items-center rounded-lg border border-dashed border-brand bg-brand-pale/70 text-xs font-black text-brand-dark">连接上游图片后预览</div>
      </>
    );
  }

  if (node.type === "preview") {
    return (
      <div className="grid min-h-[148px] place-items-center overflow-hidden rounded-lg border border-dashed border-brand bg-brand-pale/70 text-center text-xs font-black text-brand-dark">
        {node.values.imageData ? (
          <ImageResultPreview
            src={node.values.imageData}
            alt="预览结果"
            onPreview={() => onPreviewImage(node.values.imageData)}
            onDownload={() => onDownloadImage(node.values.imageData)}
          />
        ) : node.values.text || "连接并运行..."}
      </div>
    );
  }

  return <div className="grid min-h-[148px] place-items-center rounded-lg border border-dashed border-brand bg-brand-pale/70 text-xs font-black text-brand-dark">连接并运行...</div>;
}

function ImageResultPreview({
  src,
  alt,
  onPreview,
  onDownload,
}: {
  src: string;
  alt: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="grid w-full gap-2">
      <button className="group grid min-h-[150px] w-full place-items-center overflow-hidden rounded-lg border border-brand/20 bg-white/80" type="button" onClick={onPreview}>
        <img className="max-h-[220px] w-full object-contain transition-transform group-hover:scale-[1.02]" src={src} alt={alt} />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-9 rounded-lg border-2 border-brand bg-white px-2 text-xs font-black text-brand-dark" type="button" onClick={onPreview}>
          放大浏览
        </button>
        <button className="min-h-9 rounded-lg bg-brand px-2 text-xs font-black text-white" type="button" onClick={onDownload}>
          下载图片
        </button>
      </div>
    </div>
  );
}

function ImageViewer({
  src,
  title,
  onClose,
  onDownload,
}: {
  src: string;
  title: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[30] grid bg-black/82 p-4 text-white" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="flex min-h-0 flex-col gap-3" onClick={(event) => event.stopPropagation()}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-black">{title}</h2>
          <div className="flex gap-2">
            <button className="min-h-10 rounded-lg bg-white px-4 font-black text-brand-dark" type="button" onClick={onDownload}>
              下载图片
            </button>
            <button className="min-h-10 rounded-lg border border-white/70 px-4 font-black text-white" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto rounded-xl bg-black/45 p-3">
          <img className="max-h-full max-w-full object-contain" src={src} alt={title} />
        </div>
      </div>
    </div>
  );
}

function CatBadge() {
  return (
    <span className="inline-grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-full border-2 border-white bg-white shadow-inner" aria-hidden="true">
      <img className="h-full w-full scale-125 object-cover" src="/assets/pumpkin-cat-avatar.png" alt="" />
    </span>
  );
}

function DesktopChrome({
  dark,
  camera,
  status,
  isRunning,
  activePanel,
  onToggleDark,
  onShowChooser,
  onShowPanel,
  onExport,
  onImportClick,
  onSave,
  onRun,
  onStop,
}: {
  dark: boolean;
  camera: Camera;
  status: string;
  isRunning: boolean;
  activePanel: string | null;
  onToggleDark: () => void;
  onShowChooser: () => void;
  onShowPanel: (panel: PanelKey | null) => void;
  onExport: () => void;
  onImportClick: () => void;
  onSave: () => void;
  onRun: () => void;
  onStop: () => void;
}) {
  const dockButton = "inline-flex min-h-[54px] min-w-[162px] items-center gap-2 rounded-[13px] border-[3px] border-brand bg-white/95 px-5 text-[17px] font-black text-brand-dark shadow-orange";
  return (
    <>
      <button className="absolute right-6 top-6 z-[5] min-h-11 rounded-full border-[3px] border-brand bg-white/95 px-5 font-black text-brand-dark shadow-orange" type="button" onClick={onShowChooser}>
        选择界面
      </button>
      <div className="absolute left-6 top-6 z-[5] flex h-14 items-center gap-2.5 rounded-[18px] border-[3px] border-brand bg-white/95 px-4 font-extrabold shadow-orange">
        <span>浅色</span>
        <button className="h-[34px] w-[58px] rounded-full bg-brand p-1" type="button" aria-pressed={dark} onClick={onToggleDark}>
          <span className={cn("block h-[26px] w-[26px] rounded-full bg-white transition-transform", dark && "translate-x-6")} />
        </button>
        <span>深色</span>
      </div>
      <nav className="absolute left-6 top-[120px] z-[5] grid gap-3.5">
        <button className={dockButton} type="button" onClick={() => onShowPanel(activePanel === "guide" ? null : "guide")}>📖 操作指南</button>
        <button className={dockButton} type="button" onClick={onExport}>📤 导出工作流</button>
        <button className={dockButton} type="button" onClick={onImportClick}>📥 导入工作流</button>
        <button className={dockButton} type="button" onClick={onSave}>💾 保存工作流</button>
        <button className={dockButton} type="button" onClick={() => onShowPanel(activePanel === "template" ? null : "template")}>📁 工作流模板</button>
      </nav>
      <div className="absolute bottom-[132px] left-6 z-[5] grid gap-3.5">
        <button className="inline-flex min-h-[54px] min-w-[132px] items-center gap-2 rounded-[13px] border-[3px] border-brand/30 bg-white/95 px-5 text-[17px] font-black text-brand-muted shadow-orange" type="button" onClick={() => onShowPanel(activePanel === "settings" ? null : "settings")}>
          ⚙ 系统设置
        </button>
        <button className="inline-flex min-h-[54px] min-w-[138px] items-center gap-2 rounded-[13px] border-[3px] border-brand bg-brand-pale px-5 text-[17px] font-black text-brand shadow-orange" type="button" onClick={() => onShowPanel(activePanel === "history" ? null : "history")}>
          📜 生成历史
        </button>
      </div>
      <nav className="absolute right-[-18px] top-[110px] z-[5] grid justify-items-end gap-3.5">
        <button className="inline-flex min-h-[58px] items-center gap-2 rounded-full border-4 border-brand bg-brand-pale px-5 text-[17px] font-black text-brand shadow-orange" type="button" onClick={() => onShowPanel("guide")}>📖 查看使用教程</button>
        <button className="inline-flex min-h-[58px] items-center gap-2 rounded-full border-4 border-brand bg-brand-pale px-5 text-[17px] font-black text-brand shadow-orange" type="button" onClick={() => onShowPanel(activePanel === "line" ? null : "line")}>🎨 连线样式</button>
      </nav>
      <button className="absolute bottom-[340px] right-[-10px] z-[5] inline-flex min-h-[58px] min-w-[132px] items-center gap-2 rounded-full border-4 border-brand bg-brand-pale px-5 text-[17px] font-black text-brand shadow-orange" type="button">
        <CatBadge />
        南瓜
      </button>
      <div className="absolute bottom-6 right-0 z-[5] flex items-center gap-3">
        <button className="inline-flex min-h-[58px] min-w-[162px] items-center gap-2 rounded-full border-4 border-[#e5b48a] bg-white/95 px-5 text-[17px] font-black text-brand shadow-orange" type="button" onClick={onStop}>■ 停止运行</button>
        <button className="inline-flex min-h-[58px] min-w-[170px] items-center gap-2 rounded-l-full border-4 border-brand-dark bg-brand px-5 text-[17px] font-black text-white shadow-orange disabled:opacity-60" type="button" disabled={isRunning} onClick={onRun}>
          {isRunning ? "运行中..." : "🚀 运行工作流"}
        </button>
      </div>
      <div className="absolute bottom-[30px] left-[230px] z-[5] flex items-center gap-2.5 rounded-xl border border-brand/30 bg-white/95 px-3 py-2 text-sm text-brand-muted shadow-orange">
        <span className="font-black text-brand-ink">{Math.round(camera.scale * 100)}%</span>
        <span>{status}</span>
      </div>
    </>
  );
}

function PanelShell({ title, children, onClose, className = "" }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <section className={cn("info-panel absolute z-[5] max-h-[calc(100vh-132px)] overflow-auto rounded-[18px] border-[3px] border-brand bg-white/95 text-brand-ink shadow-orange", className)}>
      <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-brand/30 bg-inherit px-5 py-3.5">
        <h2 className="m-0 text-xl font-black text-brand-dark">{title}</h2>
        <button className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-brand/10 text-[22px]" type="button" onClick={onClose}>×</button>
      </div>
      {children}
    </section>
  );
}

function GuidePanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="📋 操作指南" onClose={onClose} className="left-6 top-[92px] w-[min(88vw,1520px)]">
      <div className="grid gap-5 p-7 text-brand-muted">
        {[
          ["画布操作", "右键空白：添加各类卡片", "右键节点：复制 / 删除 / 固定", "Delete：删除选中卡片，连线自动解除", "Ctrl / ⌘ + 鼠标框选：多选节点", "中键拖拽或空格拖拽：平移画布"],
          ["复制粘贴", "Ctrl+C / V：复制粘贴卡片（含连线）", "Ctrl+Z：撤销最近一次新增、删除或移动", "保存工作流：写入浏览器缓存，下次打开自动恢复", "导入 / 导出工作流：使用 JSON 文件转移节点图"],
          ["API 图像生成", "橙孔为提示词入口，绿孔为参考图或图片输出", "图像生成节点支持香蕉模型和 GPT 模型", "运行工作流会按连线顺序检查节点，并记录到生成历史"],
          ["智能对话", "黄孔接受文本卡片或对话输出作为提示词补充", "五个绿孔可作为图 1～图 5 参考图入口", "可同时接多张图片一起对话"],
        ].map(([title, ...items]) => (
          <article key={title} className="grid gap-2">
            <h3 className="m-0 text-lg font-black">{title}</h3>
            {items.map((item) => <p key={item} className="m-0 leading-7">{item}</p>)}
          </article>
        ))}
      </div>
    </PanelShell>
  );
}

function TemplatePanel({ onClose, onLoad }: { onClose: () => void; onLoad: (template: "all" | "image-basic" | "reference" | "chat") => void }) {
  const templates: Array<["all" | "image-basic" | "reference" | "chat", string]> = [["all", "节点全量模板"], ["image-basic", "文本生图 + 预览"], ["reference", "参考图生图"], ["chat", "智能对话增强提示词"]];
  return (
    <PanelShell title="📁 工作流模板" onClose={onClose} className="left-[210px] top-[120px] w-[360px]">
      <div className="grid gap-2.5 p-4">
        {templates.map(([id, label]) => (
          <button key={id} className="min-h-11 rounded-xl border-2 border-brand bg-white px-3.5 text-left font-black text-brand-dark" type="button" onClick={() => onLoad(id)}>
            {label}
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

function HistoryPanel({ items, onClose }: { items: HistoryItem[]; onClose: () => void }) {
  return (
    <PanelShell title="📜 生成历史" onClose={onClose} className="left-[210px] top-[120px] w-[360px]">
      <div className="grid gap-2.5 p-4 text-brand-muted">
        {items.length ? items.map((item) => <div key={item.time} className="rounded-xl border border-brand/30 bg-white p-3">{item.time} · {item.nodes} 个节点 · {item.connections} 条连线</div>) : <p>运行工作流后会在这里记录。</p>}
      </div>
    </PanelShell>
  );
}

function SettingsPanel({
  value,
  onChange,
  onChooseDirectory,
  onClose,
}: {
  value: AppSettings;
  onChange: (value: AppSettings) => void;
  onChooseDirectory: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("directory");
  const inputClass = "min-h-11 w-full rounded-xl border border-brand/25 bg-white px-3 text-brand-ink outline-none focus:border-brand";
  const textareaClass = "min-h-[118px] w-full resize-y rounded-xl border border-brand/25 bg-white p-3 font-mono text-sm leading-6 text-brand-ink outline-none focus:border-brand";
  const labelClass = "text-sm font-black text-brand-muted";
  const tabClass = (current: SettingsTab) =>
    cn(
      "min-h-[58px] border-b-4 px-6 text-[17px] font-black transition",
      tab === current ? "border-brand bg-brand-pale text-brand-dark" : "border-transparent bg-white text-brand-muted hover:bg-brand-pale/50",
    );
  const updateChat = (patch: Partial<ApiConfig>) => onChange({ ...value, chatApi: { ...value.chatApi, ...patch } });
  const updateImage = (patch: Partial<ApiConfig>) => onChange({ ...value, imageApi: { ...value.imageApi, ...patch } });
  const updateMobile = (patch: Partial<ApiConfig>) => onChange({ ...value, mobileApi: { ...value.mobileApi, ...patch } });
  const updatePolling = (patch: Partial<AppSettings["polling"]>) => onChange({ ...value, polling: { ...value.polling, ...patch } });
  const updateCustom = (patch: Partial<AppSettings["customApi"]>) => onChange({ ...value, customApi: { ...value.customApi, ...patch } });
  const modelSelect = (models: ModelOption[], selected: string, onSelect: (value: string) => void) => (
    <select className={inputClass} value={selected} onChange={(event) => onSelect(event.target.value)}>
      {models.map((model) => (
        <option key={model.value} value={model.value}>{model.provider} · {model.label}</option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-5">
      <section className="w-[min(94vw,920px)] overflow-hidden rounded-[28px] border-[3px] border-brand bg-white shadow-orange">
        <header className="flex min-h-[92px] items-center justify-between border-b border-brand/25 px-9">
          <h2 className="m-0 flex items-center gap-3 text-[28px] font-black text-brand-ink">
            <span className="text-[30px]">⚙</span>
            系统设置
          </h2>
          <button className="grid h-14 w-14 place-items-center rounded-xl border-[3px] border-brand/55 bg-white text-3xl text-brand-muted" type="button" onClick={onClose} aria-label="关闭设置">
            ×
          </button>
        </header>

        <nav className="grid grid-cols-2 border-b border-brand/25 bg-white text-center md:grid-cols-6">
          <button className={tabClass("directory")} type="button" onClick={() => setTab("directory")}>📁 目录</button>
          <button className={tabClass("chat")} type="button" onClick={() => setTab("chat")}>💬 对话 API</button>
          <button className={tabClass("image")} type="button" onClick={() => setTab("image")}>🎨 图像 API</button>
          <button className={tabClass("mobile")} type="button" onClick={() => setTab("mobile")}>📱 手机 API</button>
          <button className={tabClass("polling")} type="button" onClick={() => setTab("polling")}>🔁 API 轮询</button>
          <button className={tabClass("custom")} type="button" onClick={() => setTab("custom")}>🔗 自定义 API</button>
        </nav>

        <div className="max-h-[calc(100vh-240px)] overflow-auto bg-brand-pale/35 p-8">
          {tab === "directory" && (
            <div className="grid gap-6">
              <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
                <label className={labelClass}>当前目录</label>
                <div className="rounded-xl border border-brand/20 bg-slate-50 px-4 py-5 text-[22px] font-black text-brand-ink">
                  {value.imageDirectory || "未设置"}
                </div>
                <button className="min-h-[70px] rounded-2xl border-b-4 border-brand-dark bg-brand px-5 text-xl font-black text-white shadow-orange" type="button" onClick={onChooseDirectory}>
                  选择目录
                </button>
              </section>
              <p className="rounded-2xl border-2 border-brand/30 bg-white px-5 py-4 text-brand-muted">
                保存目录用于本地原图和生成图管理。
              </p>
            </div>
          )}

          {tab === "chat" && (
            <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
              <label className={labelClass}>接口地址</label>
              <input className={inputClass} value={value.chatApi.endpoint} onChange={(event) => updateChat({ endpoint: event.target.value })} placeholder="https://api.example.com/v1/chat/completions" />
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={value.chatApi.apiKey} onChange={(event) => updateChat({ apiKey: event.target.value })} placeholder="sk-..." />
              <label className={labelClass}>模型</label>
              {modelSelect(CHAT_MODEL_OPTIONS, value.chatApi.model, (model) => updateChat({ model }))}
            </section>
          )}

          {tab === "image" && (
            <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
              <label className={labelClass}>接口地址</label>
              <input className={inputClass} value={value.imageApi.endpoint} onChange={(event) => updateImage({ endpoint: event.target.value })} placeholder="https://api.example.com/v1/images/generations" />
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={value.imageApi.apiKey} onChange={(event) => updateImage({ apiKey: event.target.value })} placeholder="sk-..." />
              <label className={labelClass}>模型</label>
              {modelSelect(IMAGE_MODEL_OPTIONS, value.imageApi.model, (model) => updateImage({ model }))}
            </section>
          )}

          {tab === "mobile" && (
            <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
              <div className="rounded-2xl border border-brand/20 bg-brand-pale/70 px-4 py-3 text-sm font-extrabold leading-6 text-brand-muted">
                手机模式单独使用这一组接口，不再占用电脑端的图像 API 配置。
              </div>
              <label className={labelClass}>接口地址</label>
              <input className={inputClass} value={value.mobileApi.endpoint} onChange={(event) => updateMobile({ endpoint: event.target.value })} placeholder="https://api.example.com/mobile/generate" />
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={value.mobileApi.apiKey} onChange={(event) => updateMobile({ apiKey: event.target.value })} placeholder="sk-..." />
              <label className={labelClass}>生图模型</label>
              {modelSelect(MOBILE_IMAGE_MODEL_OPTIONS, value.mobileApi.model, (model) => updateMobile({ model }))}
            </section>
          )}

          {tab === "polling" && (
            <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
              <label className="flex items-center gap-3 text-base font-black text-brand-ink">
                <input className="h-5 w-5 accent-brand" type="checkbox" checked={value.polling.enabled} onChange={(event) => updatePolling({ enabled: event.target.checked })} />
                启用 API 轮询
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className={labelClass}>间隔秒数</label>
                  <input className={inputClass} type="number" min="1" value={value.polling.intervalSeconds} onChange={(event) => updatePolling({ intervalSeconds: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>超时秒数</label>
                  <input className={inputClass} type="number" min="10" value={value.polling.timeoutSeconds} onChange={(event) => updatePolling({ timeoutSeconds: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>最大次数</label>
                  <input className={inputClass} type="number" min="1" value={value.polling.maxAttempts} onChange={(event) => updatePolling({ maxAttempts: event.target.value })} />
                </div>
              </div>
            </section>
          )}

          {tab === "custom" && (
            <section className="grid gap-4 rounded-2xl border-2 border-brand/40 bg-white p-7">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[150px_1fr]">
                <div className="grid gap-2">
                  <label className={labelClass}>方法</label>
                  <select className={inputClass} value={value.customApi.method} onChange={(event) => updateCustom({ method: event.target.value })}>
                    <option>POST</option>
                    <option>GET</option>
                    <option>PUT</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>接口地址</label>
                  <input className={inputClass} value={value.customApi.endpoint} onChange={(event) => updateCustom({ endpoint: event.target.value })} />
                </div>
              </div>
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={value.customApi.apiKey} onChange={(event) => updateCustom({ apiKey: event.target.value })} placeholder="可选" />
              <label className={labelClass}>模型</label>
              <input className={inputClass} value={value.customApi.model} onChange={(event) => updateCustom({ model: event.target.value })} />
              <label className={labelClass}>Headers JSON</label>
              <textarea className={textareaClass} value={value.customApi.headers} onChange={(event) => updateCustom({ headers: event.target.value })} />
              <label className={labelClass}>Body 模板</label>
              <textarea className={textareaClass} value={value.customApi.bodyTemplate} onChange={(event) => updateCustom({ bodyTemplate: event.target.value })} />
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function LineStylePanel({ value, onChange, onClose }: { value: LineStyle; onChange: (value: LineStyle) => void; onClose: () => void }) {
  const update = (patch: Partial<LineStyle>) => onChange({ ...value, ...patch });
  const selectClass = "h-10 w-full rounded-lg border border-brand/30 bg-white px-2 text-brand-ink";
  return (
    <PanelShell title="🎨 连线样式" onClose={onClose} className="right-[34px] top-[250px] w-[360px]">
      <div className="grid gap-2.5 p-4">
        <label className="text-sm font-black text-brand-muted">线条颜色</label>
        <select className={selectClass} value={value.colorMode} onChange={(event) => update({ colorMode: event.target.value as LineColorMode })}>
          <option value="by-port">按端口类型</option>
          <option value="green">图片绿</option>
          <option value="orange">深橘色</option>
          <option value="purple">预览紫</option>
          <option value="blue">白色</option>
          <option value="custom">自定义颜色</option>
        </select>
        <label className="text-sm font-black text-brand-muted">自定义颜色</label>
        <input className={selectClass} type="color" value={value.customColor} onChange={(event) => update({ customColor: event.target.value })} />
        <label className="text-sm font-black text-brand-muted">线型</label>
        <select className={selectClass} value={value.type} onChange={(event) => update({ type: event.target.value as LineType })}>
          <option value="curve">平滑曲线</option>
          <option value="straight">直线</option>
          <option value="elbow">折线</option>
        </select>
        <label className="text-sm font-black text-brand-muted">虚实</label>
        <select className={selectClass} value={value.pattern} onChange={(event) => update({ pattern: event.target.value as LinePattern })}>
          <option value="solid">实线</option>
          <option value="dashed">虚线</option>
          <option value="dotted">点线</option>
        </select>
        <label className="text-sm font-black text-brand-muted">粗细 {value.width}px</label>
        <input className="w-full accent-brand" type="range" min="2" max="9" value={value.width} onChange={(event) => update({ width: Number(event.target.value) })} />
      </div>
    </PanelShell>
  );
}

function ContextMenu({ x, y, onAdd }: { x: number; y: number; onAdd: (type: NodeType) => void }) {
  const groups: Array<[string, Array<[NodeType, string]>]> = [
    ["🧠 AI 模型", [["image-generation", "🎨 图像生成"], ["chat", "💬 智能对话"]]],
    ["🔗 自定义 API", [["custom-image", "🎨 图像生成（自定义）"], ["custom-chat", "💬 智能对话（自定义）"]]],
    ["📝 文本", [["text-card", "📝 文本卡片"], ["multiline-text", "📋 多行文本"]]],
    ["🖼 图片", [["reference-image", "🖼 加载参考图"]]],
    ["🔧 工具", [["logic-switch", "🔀 逻辑开关"], ["resize-image", "📐 缩放图片"]]],
    ["🔍 其他", [["preview", "👁 预览任意"]]],
  ];
  return (
    <div className="context-menu-surface absolute z-[5] w-[268px] rounded-3xl border-[3px] border-brand bg-white/95 p-3.5 shadow-orange" style={{ left: x, top: y }} role="menu">
      {groups.map(([title, items]) => (
        <div key={title} className="grid gap-1">
          <p className="m-0 flex justify-between px-2.5 py-1.5 text-sm font-black text-brand-muted">{title}<span>◂</span></p>
          {items.map(([type, label]) => (
            <button key={type} className="min-h-9 rounded-lg px-2.5 text-left text-lg font-black hover:bg-brand/10" type="button" onClick={() => onAdd(type)}>{label}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function NodeMenu({ x, y, onAction }: { x: number; y: number; onAction: (action: "pin" | "disable" | "duplicate" | "delete") => void }) {
  return (
    <div className="context-menu-surface absolute z-[5] grid w-[214px] gap-1 rounded-2xl border-[3px] border-brand bg-white/95 p-3.5 shadow-orange" style={{ left: x, top: y }} role="menu">
      <button className="min-h-9 rounded-lg px-2.5 text-left font-black hover:bg-brand/10" type="button" onClick={() => onAction("pin")}>📌 固定 / 取消固定</button>
      <button className="min-h-9 rounded-lg px-2.5 text-left font-black hover:bg-brand/10" type="button" onClick={() => onAction("disable")}>⏸ 禁用 / 启用</button>
      <button className="min-h-9 rounded-lg px-2.5 text-left font-black hover:bg-brand/10" type="button" onClick={() => onAction("duplicate")}>📄 复制节点</button>
      <button className="min-h-9 rounded-lg px-2.5 text-left font-black hover:bg-brand/10" type="button" onClick={() => onAction("delete")}>🗑 删除节点</button>
    </div>
  );
}

function MobileGenerator({
  prompt,
  model,
  apiConfig,
  status,
  isGenerating,
  referenceDataUrl,
  resultDataUrl,
  onShowChooser,
  onPromptChange,
  onApiConfigChange,
  onGenerate,
  onReferenceChange,
  onCopyPayload,
}: {
  prompt: string;
  model: string;
  apiConfig: ApiConfig;
  status: string;
  isGenerating: boolean;
  referenceDataUrl: string;
  resultDataUrl: string;
  onShowChooser: () => void;
  onPromptChange: (value: string) => void;
  onApiConfigChange: (patch: Partial<ApiConfig>) => void;
  onGenerate: () => void;
  onReferenceChange: (file: File) => void;
  onCopyPayload: () => void;
}) {
  const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900";
  return (
    <section className="grid min-h-screen grid-cols-1 gap-7 bg-white p-4 md:grid-cols-[minmax(310px,420px)_1fr] md:p-6" aria-label="手机生图模式">
      <header className="flex items-center justify-between md:hidden">
        <button className="min-h-10 rounded-lg bg-brand px-3.5 font-extrabold text-white" type="button" onClick={onShowChooser}>选择界面</button>
        <h1 className="m-0 text-xl font-black">手机生图</h1>
      </header>
      <div className="grid place-items-center">
        <div className="w-full max-w-[390px] rounded-[34px] bg-[#151a22] p-4 shadow-orange">
          <div className="flex min-h-[688px] flex-col gap-3 rounded-3xl bg-[#fbfbfc] p-4">
            <label className="relative grid h-[210px] cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-slate-400 bg-slate-100 text-slate-500" htmlFor="referenceInput">
              <input id="referenceInput" className="absolute inset-0 cursor-pointer opacity-0" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onReferenceChange(event.target.files[0])} />
              {referenceDataUrl ? <img className="h-full w-full object-cover" src={referenceDataUrl} alt="" /> : <span>上传参考图</span>}
              {referenceDataUrl && <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/60 px-2 py-1 text-white">更换参考图</span>}
            </label>
            <label className="text-xs font-extrabold text-slate-500" htmlFor="promptInput">提示词</label>
            <textarea className="min-h-[120px] resize-y rounded-lg border border-slate-300 bg-white p-2.5 leading-6 text-slate-900" id="promptInput" rows={5} value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="描述你想生成的图片，例如：赛博朋克风格的城市夜景，霓虹灯，电影感光影" />
            <label className="text-xs font-extrabold text-slate-500" htmlFor="modelSelect">生图模型</label>
            <select className={inputClass} id="modelSelect" value={model} onChange={(event) => onApiConfigChange({ model: event.target.value })}>
              {MOBILE_IMAGE_MODEL_OPTIONS.map((modelOption) => (
                <option key={modelOption.value} value={modelOption.value}>{modelOption.provider} · {modelOption.label}</option>
              ))}
            </select>
            <details className="grid gap-2 rounded-xl border border-brand/25 bg-brand-pale/70 p-3 text-sm leading-6 text-brand-muted">
              <summary className="cursor-pointer font-black text-brand">手机 API 接口</summary>
              <div className="mt-3 grid gap-2">
                <label className="text-xs font-extrabold text-slate-500" htmlFor="mobileApiEndpoint">接口地址</label>
                <input className={inputClass} id="mobileApiEndpoint" type="url" value={apiConfig.endpoint} onChange={(event) => onApiConfigChange({ endpoint: event.target.value })} placeholder="https://api.example.com/mobile/generate" />
                <label className="text-xs font-extrabold text-slate-500" htmlFor="mobileApiKey">API Key</label>
                <input className={inputClass} id="mobileApiKey" type="password" value={apiConfig.apiKey} onChange={(event) => onApiConfigChange({ apiKey: event.target.value })} placeholder="仅保存在本地浏览器" />
              </div>
            </details>
            <button className="min-h-11 rounded-xl bg-brand font-black text-white disabled:opacity-60" type="button" disabled={isGenerating} onClick={onGenerate}>生成图片</button>
            <p className="m-0 min-h-[38px] text-sm leading-6 text-slate-500">{status}</p>
          </div>
        </div>
      </div>
      <section className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-4">
        <h2 className="m-0 text-lg font-black">生成结果</h2>
        <div className="grid min-h-[360px] place-items-center overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-500">
          {resultDataUrl ? <img className="h-full w-full object-contain" src={resultDataUrl} alt="生成结果" /> : <span>生成后的图片会显示在这里</span>}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button className="min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-brand-ink disabled:opacity-60" type="button" disabled={!resultDataUrl} onClick={() => {
            if (!resultDataUrl) return;
            const link = document.createElement("a");
            link.download = `generated-${Date.now()}.png`;
            link.href = resultDataUrl;
            link.click();
          }}>下载结果</button>
          <button className="min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-brand-ink" type="button" onClick={onCopyPayload}>复制请求参数</button>
        </div>
      </section>
    </section>
  );
}
