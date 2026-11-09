/**
 * Desktop Defender Electron Main
 * Author: sashasmith-syber
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const CONFIG_FILE = () => path.join(app.getPath("userData"), "desktop-defender-config.json");

const DEFAULT_CONFIG = {
  agentBaseUrl: "http://127.0.0.1:8787",
  agentToken: ""
};

function readTokenFile() {
  try {
    const tokenPath = path.join(app.getPath("home"), ".desktop-defender-agent-token");
    return fs.readFileSync(tokenPath, "utf8").trim();
  } catch {
    return "";
  }
}

function readConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    const raw = fs.readFileSync(CONFIG_FILE(), "utf8");
    cfg = { ...cfg, ...JSON.parse(raw) };
  } catch {
    // first run
  }
  if (!cfg.agentToken) {
    cfg.agentToken = readTokenFile();
  }
  return cfg;
}

function writeConfig(next) {
  const dir = path.dirname(CONFIG_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(next, null, 2), "utf8");
}

const AGENT_REQUEST_TIMEOUT_MS = 8000;

async function agentRequest({ method = "GET", path: apiPath = "/", body = null }) {
  const cfg = readConfig();
  const base = (cfg.agentBaseUrl || DEFAULT_CONFIG.agentBaseUrl).replace(/\/$/, "");
  const url = `${base}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  const headers = {
    Accept: "application/json",
    "X-Agent-Token": cfg.agentToken || ""
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_REQUEST_TIMEOUT_MS);
  const init = { method: method.toUpperCase(), headers, signal: controller.signal };
  if (body != null && init.method !== "GET" && init.method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  try {
    let response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (err?.name === "AbortError") {
        const error = new Error("Request timed out");
        error.code = "TIMEOUT";
        throw error;
      }
      const error = new Error(err.message || "Network Error");
      error.code = "NETWORK";
      throw error;
    }

    let text;
    try {
      text = await response.text();
    } catch (err) {
      if (err?.name === "AbortError") {
        const error = new Error("Request timed out");
        error.code = "TIMEOUT";
        throw error;
      }
      throw err;
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(
        (data && (data.detail || data.message)) || `HTTP ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function isTrustedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return true;
    const startUrl = process.env.ELECTRON_START_URL;
    return Boolean(startUrl) && u.origin === new URL(startUrl).origin;
  } catch {
    return false;
  }
}

function isTrustedSender(event) {
  return Boolean(event.senderFrame) && isTrustedUrl(event.senderFrame.url);
}

function isLoopbackHttpUrl(value) {
  try {
    const u = new URL(value);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    );
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b0f14",
    title: "Desktop Defender",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Block navigation away from the app and deny all new windows
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer-dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("config:get", async (event) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted IPC sender");
    return {
      agentBaseUrl: store.get("agentBaseUrl"),
      agentToken: store.get("agentToken")
    };
  });

  ipcMain.handle("config:set", async (event, payload) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted IPC sender");
    if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
    if (payload.agentBaseUrl !== undefined) {
      if (typeof payload.agentBaseUrl !== "string" || !isLoopbackHttpUrl(payload.agentBaseUrl)) {
        return { ok: false, error: "agentBaseUrl must be a local http(s) URL" };
      }
      store.set("agentBaseUrl", payload.agentBaseUrl);
    }
    if (payload.agentToken !== undefined) {
      if (typeof payload.agentToken !== "string" || payload.agentToken.length === 0 || payload.agentToken.length > 512) {
        return { ok: false, error: "Invalid agentToken" };
      }
      store.set("agentToken", payload.agentToken);
    }
    return { ok: true };
  });

  ipcMain.handle("agent:request", async (_event, payload) => {
    try {
      const data = await agentRequest(payload || {});
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err.message || "Request failed",
        status: err.status || null,
        data: err.data || null
      };
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
