import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BackendTestResult,
  GenerationAdapter,
  GenerationRequest,
  GenerationTask,
  TaskStatus
} from "../../shared/types";

interface SeedanceAdapterOptions {
  baseUrl: string;
  username: string;
  password: string;
  outputDirectory: string;
}

type JsonObject = Record<string, unknown>;
type SeedanceContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role: "reference_image" };

export class SeedanceAdapter implements GenerationAdapter {
  private readonly consoleBase: string;
  private readonly generationBase: string;
  private consoleTokenPromise?: Promise<string>;
  private apiKeyPromise?: Promise<string>;

  constructor(private readonly options: SeedanceAdapterOptions) {
    const root = options.baseUrl.replace(/\/$/, "");
    this.consoleBase = `${root}/ai-open-platform-api/v1`;
    this.generationBase = `${root}/ai-open-platform-api/api/v3`;
  }

  async test(signal?: AbortSignal): Promise<BackendTestResult> {
    const start = Date.now();
    if (!this.options.username || !this.options.password) {
      return {
        ok: false,
        label: "Seedance 2.0 API",
        latencyMs: 0,
        details: {},
        message: "尚未保存 Seedance 2.0 账号和密码。"
      };
    }
    try {
      const profile = await this.profile(signal ?? AbortSignal.timeout(12_000));
      const walletBalance = pickString(profile, ["wallet_balance", "walletBalance"]);
      const maxConcurrent = pickNumber(profile, ["max_concurrent", "maxConcurrent"]);
      return {
        ok: true,
        label: "Seedance 2.0 API",
        latencyMs: Date.now() - start,
        details: { walletBalance, maxConcurrent },
        message: walletBalance ? `鉴权成功，账户余额 ${walletBalance} 点。` : "Seedance 2.0 鉴权成功。"
      };
    } catch (error) {
      return {
        ok: false,
        label: "Seedance 2.0 API",
        latencyMs: Date.now() - start,
        details: {},
        message: error instanceof Error ? error.message : "Seedance 2.0 API 不可达"
      };
    }
  }

  async generate(
    request: GenerationRequest,
    task: GenerationTask,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<Pick<GenerationTask, "providerTaskId" | "outputPath" | "outputUrl" | "usage">> {
    if (!this.options.username || !this.options.password) {
      throw new Error("请先在连接设置中保存 Seedance 2.0 账号和密码。");
    }
    if (request.mode === "video") {
      throw new Error("当前 Seedance 2.0 连接器暂不提交视频参考，请改用文生视频或图生视频。 ");
    }

    onProgress("uploading", 5, "正在准备 Seedance 2.0 素材");
    const content: SeedanceContent[] = [{ type: "text", text: request.prompt.trim() }];
    const imagePaths = unique([
      request.mode === "image" ? request.sourceImagePath : undefined,
      request.firstFramePath,
      request.lastFramePath
    ]);
    for (const imagePath of imagePaths) {
      const url = await this.uploadImage(imagePath, signal);
      content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
    }

    const apiKey = await this.authorizeApi(signal);
    onProgress("queued", 10, "正在提交 Seedance 2.0 任务");
    const created = await jsonRequest(`${this.generationBase}/contents/generations/tasks`, {
      method: "POST",
      headers: bearer(apiKey),
      body: JSON.stringify({
        model: "doubao-seedance-2-0-260128",
        content,
        resolution: "480p",
        ratio: request.ratio === "adaptive" ? "16:9" : request.ratio,
        duration: request.duration,
        generate_audio: true
      }),
      signal
    }, "Seedance 2.0 提交");
    const taskId = topString(created, ["id", "task_id", "taskId"]);
    if (!taskId) throw new Error("Seedance 2.0 返回结果中没有 task ID。 ");

    const result = await this.wait(taskId, apiKey, onProgress, signal);
    onProgress("downloading", 95, "正在保存 Seedance 2.0 结果");
    const outputPath = await this.download(result.url, task.id, signal);
    return {
      providerTaskId: taskId,
      outputPath,
      outputUrl: result.url,
      usage: { outputSeconds: request.duration }
    };
  }

  private async profile(signal?: AbortSignal): Promise<JsonObject> {
    const consoleToken = await this.authorizeConsole(signal);
    const body = await jsonRequest(`${this.consoleBase}/user/profile`, {
      method: "POST",
      headers: bearer(consoleToken),
      body: "{}",
      signal
    }, "Seedance 2.0 账户查询");
    return objectValue(body.data) ?? body;
  }

  private authorizeConsole(signal?: AbortSignal): Promise<string> {
    if (!this.consoleTokenPromise) {
      this.consoleTokenPromise = (async () => {
        const login = await jsonRequest(`${this.consoleBase}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: this.options.username, password: this.options.password }),
          signal
        }, "Seedance 2.0 登录");
        const token = pickString(login, ["token", "access_token", "jwt", "authorization"]);
        if (!token) throw new Error("Seedance 2.0 登录成功，但没有返回访问令牌。 ");
        return token;
      })().catch((error) => {
        this.consoleTokenPromise = undefined;
        throw error;
      });
    }
    return this.consoleTokenPromise;
  }

  private authorizeApi(signal?: AbortSignal): Promise<string> {
    if (!this.apiKeyPromise) {
      this.apiKeyPromise = (async () => {
        const consoleToken = await this.authorizeConsole(signal);
        const listing = await jsonRequest(`${this.consoleBase}/console/api_key/list`, {
          method: "POST",
          headers: bearer(consoleToken),
          body: JSON.stringify({ page: 1, page_size: 20 }),
          signal
        }, "Seedance 2.0 API Key 查询");
        const apiKey = pickString(listing, ["api_key", "apiKey", "key", "secret_key", "sk"]);
        if (!apiKey) throw new Error("Seedance 2.0 账户中没有可用的 API Key。 ");
        return apiKey;
      })().catch((error) => {
        this.apiKeyPromise = undefined;
        throw error;
      });
    }
    return this.apiKeyPromise;
  }

  private async uploadImage(filePath: string, signal?: AbortSignal): Promise<string> {
    const consoleToken = await this.authorizeConsole(signal);
    const bytes = await readFile(filePath);
    const extension = path.extname(filePath).slice(1).toLowerCase() || "png";
    const contentType = mimeFor(filePath);
    const signed = await jsonRequest(`${this.consoleBase}/file/sign_upload`, {
      method: "POST",
      headers: bearer(consoleToken),
      body: JSON.stringify({
        file_name: path.basename(filePath),
        file_suffix: extension,
        size: bytes.byteLength,
        content_type: contentType
      }),
      signal
    }, "Seedance 2.0 素材签名");
    const uploadUrl = pickString(signed, ["upload_url", "uploadUrl", "put_url", "putUrl"]);
    const downloadUrl = pickString(signed, ["download_url", "downloadUrl", "url"]);
    if (!uploadUrl || !downloadUrl) throw new Error("Seedance 2.0 未返回完整的素材上传地址。 ");
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes, signal });
    if (!uploaded.ok) throw new Error(`Seedance 2.0 素材上传失败：HTTP ${uploaded.status}`);
    return downloadUrl;
  }

  private async wait(
    taskId: string,
    apiKey: string,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<{ url: string }> {
    let progress = 15;
    for (;;) {
      const body = await jsonRequest(`${this.generationBase}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
        headers: bearer(apiKey),
        signal
      }, "Seedance 2.0 状态查询");
      const status = topString(body, ["status"]) || pickString(body, ["status"]);
      if (status === "succeeded") {
        const url = pickString(body, ["video_url", "kz_video_url"]);
        if (!url) throw new Error("Seedance 2.0 已完成，但没有返回视频地址。 ");
        return { url };
      }
      if (["failed", "cancelled", "canceled"].includes(status)) {
        throw new Error(`Seedance 2.0 任务${status === "failed" ? "失败" : "已取消"}。`);
      }
      progress = Math.min(92, progress + 4);
      onProgress("running", progress, status === "queued" ? "Seedance 2.0 排队中" : "Seedance 2.0 正在生成");
      await delay(10_000, signal);
    }
  }

  private async download(url: string, taskId: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Seedance 2.0 结果下载失败：HTTP ${response.status}`);
    await mkdir(this.options.outputDirectory, { recursive: true });
    const target = path.join(this.options.outputDirectory, `${taskId}-seedance2.mp4`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    return target;
  }
}

async function jsonRequest(url: string, init: RequestInit, label: string): Promise<JsonObject> {
  const response = await fetch(url, init);
  let body: JsonObject = {};
  try {
    body = objectValue(await response.json()) ?? {};
  } catch {
    body = {};
  }
  if (!response.ok) throw new Error(`${label}失败：HTTP ${response.status}`);
  const code = typeof body.code === "number" ? body.code : undefined;
  if (code !== undefined && code !== 0 && code !== 200) {
    throw new Error(`${label}失败：服务端代码 ${code}`);
  }
  return body;
}

function bearer(value: string): Record<string, string> {
  return { Authorization: `Bearer ${value}`, "Content-Type": "application/json" };
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function topString(value: JsonObject, keys: string[]): string {
  for (const key of keys) if (typeof value[key] === "string" && value[key]) return value[key] as string;
  return "";
}

function pickString(value: unknown, keys: string[]): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickString(item, keys);
      if (found) return found;
    }
    return "";
  }
  const object = objectValue(value);
  if (!object) return "";
  const direct = topString(object, keys);
  if (direct) return direct;
  for (const nested of Object.values(object)) {
    const found = pickString(nested, keys);
    if (found) return found;
  }
  return "";
}

function pickNumber(value: unknown, keys: string[]): number | undefined {
  const stringValue = pickString(value, keys);
  if (stringValue && Number.isFinite(Number(stringValue))) return Number(stringValue);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickNumber(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const object = objectValue(value);
  if (!object) return undefined;
  for (const key of keys) if (typeof object[key] === "number") return object[key] as number;
  for (const nested of Object.values(object)) {
    const found = pickNumber(nested, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function mimeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" } as Record<string, string>)[extension] || "application/octet-stream";
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("任务已取消", "AbortError"));
    }, { once: true });
  });
}
