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
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  try {
    fs.chmodSync(CONFIG_FILE(), 0o600);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(next, null, 2), {
    encoding: "utf8",
    mode: 0o600
  });
  fs.chmodSync(CONFIG_FILE(), 0o600);
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

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer-dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("config:get", async () => readConfig());

  ipcMain.handle("config:set", async (_event, payload) => {
    const current = readConfig();
    const next = {
      agentBaseUrl: payload?.agentBaseUrl || current.agentBaseUrl,
      agentToken:
        typeof payload?.agentToken === "string" ? payload.agentToken : current.agentToken
    };
    writeConfig(next);
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
