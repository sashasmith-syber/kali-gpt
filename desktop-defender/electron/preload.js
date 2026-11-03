/**
 * Desktop Defender Preload Bridge
 * Author: sashasmith-syber
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopDefender", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (payload) => ipcRenderer.invoke("config:set", payload),
  agentRequest: (payload) => ipcRenderer.invoke("agent:request", payload)
});
