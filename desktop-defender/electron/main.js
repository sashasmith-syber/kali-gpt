const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");

const store = new Store({
  name: "desktop-defender-config",
  defaults: {
    agentBaseUrl: "http://127.0.0.1:8787",
    agentToken: "change-me-local-token"
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
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

  ipcMain.handle("config:get", async () => {
    return {
      agentBaseUrl: store.get("agentBaseUrl"),
      agentToken: store.get("agentToken")
    };
  });

  ipcMain.handle("config:set", async (_event, payload) => {
    if (payload.agentBaseUrl) store.set("agentBaseUrl", payload.agentBaseUrl);
    if (payload.agentToken) store.set("agentToken", payload.agentToken);
    return { ok: true };
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
