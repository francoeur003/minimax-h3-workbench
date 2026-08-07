import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
  type IpcMainInvokeEvent
} from "electron";
import { AdapterRegistry } from "./backends/adapterRegistry";
import { RESOURCE_LINKS } from "../shared/resourceLinks";
import type { ApiResponse, AppSettings, BackendKind, GenerationRequest } from "../shared/types";
import { GenerationOrchestrator } from "./modules/generationOrchestrator";
import { SettingsStore } from "./modules/settingsStore";
import { inspectEnvironment } from "./modules/systemInspector";
import { TaskStore } from "./modules/taskStore";

protocol.registerSchemesAsPrivileged([
  { scheme: "h3media", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

let mainWindow: BrowserWindow | undefined;
let adapters: AdapterRegistry | undefined;

app.whenReady().then(async () => {
  protocol.handle("h3media", (request) => {
    const requestedPath = new URL(request.url).searchParams.get("path");
    if (!requestedPath || !path.isAbsolute(requestedPath)) return new Response("Invalid media path", { status: 400 });
    return net.fetch(pathToFileURL(requestedPath).toString());
  });

  const settingsStore = new SettingsStore();
  adapters = new AdapterRegistry(settingsStore);
  const orchestrator = new GenerationOrchestrator(
    new TaskStore(),
    adapters,
    (task) => mainWindow?.webContents.send("task:update", task)
  );
  await orchestrator.initialize();
  registerIpc(settingsStore, adapters, orchestrator);
  mainWindow = createWindow();
  await loadApp(mainWindow);

  const screenshotPath = process.env.H3_SCREENSHOT_PATH;
  if (screenshotPath) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await writeFile(screenshotPath, (await mainWindow.webContents.capturePage()).toPNG());
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    void loadApp(mainWindow);
  }
});

app.on("before-quit", () => adapters?.close());

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const current = window.webContents.getURL();
    if (new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
  return window;
}

async function loadApp(window: BrowserWindow): Promise<void> {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(path.join(__dirname, "../../dist/index.html"));
}

function registerIpc(
  settingsStore: SettingsStore,
  registry: AdapterRegistry,
  orchestrator: GenerationOrchestrator
): void {
  handle("settings:get", () => settingsStore.get());
  handle("settings:update", async (_event, patch: Partial<AppSettings>) => {
    const next = await settingsStore.update(patch);
    registry.invalidate(next);
    return next;
  });
  handle("secret:set", async (_event, name: "minimaxApiKey" | "sshPassword", value: string) => {
    await settingsStore.setSecret(name, value);
    registry.invalidate();
    return true;
  });
  handle("secret:has", (_event, name: "minimaxApiKey" | "sshPassword") => settingsStore.hasSecret(name));
  handle("dialog:directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? undefined : result.filePaths[0];
  });
  handle("dialog:file", async (_event, kind: "image" | "video" | "key") => {
    const filters = kind === "image"
      ? [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "heic", "heif"] }]
      : kind === "video"
        ? [{ name: "视频", extensions: ["mp4", "mov", "webm", "mkv"] }]
        : [{ name: "SSH 私钥", extensions: ["pem", "key", "ppk", "*"] }];
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openFile"], filters });
    return result.canceled ? undefined : result.filePaths[0];
  });
  handle("environment:inspect", async () => inspectEnvironment((await settingsStore.get()).localComfyUrl));
  handle("resources:list", () => RESOURCE_LINKS);
  handle("backend:test", async (_event, kind: BackendKind) => (await registry.get(kind)).test());
  handle("tasks:list", () => orchestrator.list());
  handle("tasks:submit", (_event, request: GenerationRequest) => orchestrator.submit(request));
  handle("tasks:cancel", (_event, id: string) => orchestrator.cancel(id));
  handle("shell:showItem", (_event, filePath: string) => {
    if (!path.isAbsolute(filePath)) throw new Error("文件路径无效。");
    shell.showItemInFolder(filePath);
    return true;
  });
  handle("shell:openExternal", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 链接。");
    await shell.openExternal(url);
    return true;
  });
}

function handle<TArgs extends unknown[], TResult>(
  channel: string,
  action: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (event, ...args: TArgs): Promise<ApiResponse<TResult>> => {
    const requestId = randomUUID();
    try {
      return { ok: true, requestId, data: await action(event, ...args) };
    } catch (error) {
      return {
        ok: false,
        requestId,
        errorCode: "OPERATION_FAILED",
        message: error instanceof Error ? error.message : "操作失败",
        retryable: true
      };
    }
  });
}
