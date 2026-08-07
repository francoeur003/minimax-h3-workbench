import { contextBridge, ipcRenderer } from "electron";
import type { WorkbenchApi } from "../shared/types";

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: WorkbenchApi = {
  getSettings: () => invoke("settings:get"),
  updateSettings: (patch) => invoke("settings:update", patch),
  setSecret: (name, value) => invoke("secret:set", name, value),
  hasSecret: (name) => invoke("secret:has", name),
  selectDirectory: () => invoke("dialog:directory"),
  selectFile: (kind) => invoke("dialog:file", kind),
  inspectEnvironment: () => invoke("environment:inspect"),
  getDownloadManifest: () => invoke("downloads:manifest"),
  listDownloads: () => invoke("downloads:list"),
  startDownload: (itemId, comfyPath, licenseAccepted) => invoke("downloads:start", itemId, comfyPath, licenseAccepted),
  cancelDownload: (itemId) => invoke("downloads:cancel", itemId),
  testBackend: (kind) => invoke("backend:test", kind),
  listTasks: () => invoke("tasks:list"),
  submitGeneration: (request) => invoke("tasks:submit", request),
  cancelTask: (taskId) => invoke("tasks:cancel", taskId),
  showItem: (filePath) => invoke("shell:showItem", filePath),
  openExternal: (url) => invoke("shell:openExternal", url),
  onDownloadUpdate: (listener) => subscribe("download:update", listener),
  onTaskUpdate: (listener) => subscribe("task:update", listener)
};

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("h3", api);
