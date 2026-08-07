import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { DOWNLOAD_MANIFEST } from "../../shared/downloadManifest";
import type { DownloadItem, DownloadProgress } from "../../shared/types";

type ProgressListener = (progress: DownloadProgress) => void;

export class DownloadManager {
  private readonly progress = new Map<string, DownloadProgress>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(private readonly listener: ProgressListener) {
    for (const item of DOWNLOAD_MANIFEST) {
      this.progress.set(item.id, { id: item.id, status: "idle", downloadedBytes: 0, totalBytes: item.expectedBytes ?? 0 });
    }
  }

  list(): DownloadProgress[] {
    return [...this.progress.values()];
  }

  async start(itemId: string, comfyPath: string, licenseAccepted: boolean): Promise<DownloadProgress> {
    if (!licenseAccepted) throw new Error("必须先阅读并接受 MiniMax H3 Community License。 ");
    if (!comfyPath) throw new Error("请先选择 ComfyUI 目录。 ");
    const item = DOWNLOAD_MANIFEST.find((entry) => entry.id === itemId);
    if (!item) throw new Error("下载项不存在。 ");
    if (this.controllers.has(itemId)) throw new Error("该文件正在下载。 ");

    const controller = new AbortController();
    this.controllers.set(itemId, controller);
    try {
      return await this.download(item, comfyPath, controller.signal);
    } finally {
      this.controllers.delete(itemId);
    }
  }

  cancel(itemId: string): void {
    this.controllers.get(itemId)?.abort();
  }

  private async download(item: DownloadItem, root: string, signal: AbortSignal): Promise<DownloadProgress> {
    const targetPath = path.join(root, item.relativePath);
    const partialPath = `${targetPath}.part`;
    await mkdir(path.dirname(targetPath), { recursive: true });

    let existing = 0;
    try {
      existing = (await stat(partialPath)).size;
    } catch {
      existing = 0;
    }

    const headers: Record<string, string> = existing > 0 ? { Range: `bytes=${existing}-` } : {};
    const response = await fetch(item.url, { headers, redirect: "follow", signal });
    if (!response.ok && response.status !== 206) throw new Error(`下载服务器返回 ${response.status}`);
    const partialAccepted = response.status === 206;
    if (existing > 0 && !partialAccepted) {
      await unlink(partialPath).catch(() => undefined);
      existing = 0;
    }
    const remaining = Number(response.headers.get("content-length") || 0);
    const totalBytes = partialAccepted ? existing + remaining : remaining || item.expectedBytes || 0;
    const file = createWriteStream(partialPath, { flags: existing > 0 ? "a" : "w" });
    let downloadedBytes = existing;
    this.emit({ id: item.id, status: "downloading", downloadedBytes, totalBytes, targetPath });

    try {
      if (!response.body) throw new Error("下载响应没有内容。 ");
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!file.write(Buffer.from(value))) await new Promise<void>((resolve) => file.once("drain", resolve));
        downloadedBytes += value.byteLength;
        this.emit({ id: item.id, status: "downloading", downloadedBytes, totalBytes, targetPath });
      }
      await new Promise<void>((resolve, reject) => file.end((error?: Error | null) => (error ? reject(error) : resolve())));
      this.emit({ id: item.id, status: "verifying", downloadedBytes, totalBytes, targetPath });
      const actual = (await stat(partialPath)).size;
      if (totalBytes > 0 && actual !== totalBytes) throw new Error(`文件大小不完整：${actual}/${totalBytes}`);
      await rename(partialPath, targetPath);
      return this.emit({ id: item.id, status: "completed", downloadedBytes: actual, totalBytes: actual, targetPath });
    } catch (error) {
      file.destroy();
      const cancelled = signal.aborted;
      return this.emit({
        id: item.id,
        status: cancelled ? "cancelled" : "failed",
        downloadedBytes,
        totalBytes,
        targetPath,
        message: cancelled ? "已取消，保留断点文件。 " : error instanceof Error ? error.message : "下载失败"
      });
    }
  }

  private emit(progress: DownloadProgress): DownloadProgress {
    this.progress.set(progress.id, progress);
    this.listener(progress);
    return progress;
  }
}
