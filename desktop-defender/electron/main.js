const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");

const store = new Store({
  name: "desktop-defender-config",
  defaults: {
    agentBaseUrl: "http://127.0.0.1:8787"
    // Note: No default agentToken - user must configure this securely
  }
});

// Security warning if token not configured
function checkSecurityConfig() {
  const token = store.get("agentToken");
  if (!token) {
    console.warn("⚠️  SECURITY WARNING: Agent token not configured!");
    console.warn("⚠️  Please configure a secure token before using Desktop Defender.");
    console.warn("⚠️  The agent token can be found in the agent startup logs or ~/.desktop-defender-agent-token");
    return false;
  }
  return true;
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
    width: 1200,
    height: 800,
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

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
