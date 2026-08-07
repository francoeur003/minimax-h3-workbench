import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { estimateCloudCost } from "../../shared/capabilities";
import type {
  BackendTestResult,
  GenerationAdapter,
  GenerationRequest,
  GenerationTask,
  TaskStatus
} from "../../shared/types";

interface MiniMaxAdapterOptions {
  baseUrl: string;
  apiKey: string;
  outputDirectory: string;
}

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role: "first_frame" | "last_frame" | "reference_image" }
  | { type: "video_url"; video_url: { url: string }; role: "reference_video" };

export class MiniMaxAdapter implements GenerationAdapter {
  private readonly baseUrl: string;

  constructor(private readonly options: MiniMaxAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async test(signal?: AbortSignal): Promise<BackendTestResult> {
    const start = Date.now();
    if (!this.options.apiKey) {
      return { ok: false, label: "MiniMax 云 API", latencyMs: 0, details: {}, message: "尚未保存 MiniMax API Key。" };
    }
    try {
      const response = await fetch(`${this.baseUrl}/v2/query/video_generation/nonexistent`, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        signal: signal ?? AbortSignal.timeout(8_000)
      });
      const authenticated = response.status !== 401;
      return {
        ok: authenticated,
        label: "MiniMax 云 API",
        latencyMs: Date.now() - start,
        details: { httpStatus: response.status },
        message: authenticated ? "API Key 已通过鉴权检查。" : "API Key 无效或已失效。"
      };
    } catch (error) {
      return {
        ok: false,
        label: "MiniMax 云 API",
        latencyMs: Date.now() - start,
        details: {},
        message: error instanceof Error ? error.message : "MiniMax API 不可达"
      };
    }
  }

  async generate(
    request: GenerationRequest,
    task: GenerationTask,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<Pick<GenerationTask, "providerTaskId" | "outputPath" | "outputUrl" | "usage">> {
    if (!this.options.apiKey) throw new Error("请先在连接设置中保存 MiniMax API Key。 ");
    onProgress("uploading", 5, "正在编码参考素材");
    const content = await this.buildContent(request);
    onProgress("queued", 10, "正在提交 MiniMax H3 云任务");
    const response = await fetch(`${this.baseUrl}/v2/video_generation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "MiniMax-H3",
        content,
        resolution: request.resolution,
        duration: request.duration,
        ratio: request.mode === "image" || request.firstFramePath || request.lastFramePath ? "adaptive" : request.ratio
      }),
      signal
    });
    const created = (await response.json()) as { task_id?: string; error?: { type?: string; message?: string } };
    if (!response.ok || !created.task_id) throw new Error(created.error?.message || `MiniMax 提交失败：${response.status}`);
    const result = await this.wait(created.task_id, onProgress, signal);
    onProgress("downloading", 95, "正在保存云端结果");
    const outputPath = await this.download(result.url, task.id, signal);
    onProgress("succeeded", 100, "生成完成");
    return {
      providerTaskId: created.task_id,
      outputPath,
      outputUrl: result.url,
      usage: {
        inputSeconds: result.inputSeconds,
        outputSeconds: result.outputSeconds,
        estimatedUsd: estimateCloudCost(request.resolution, request.duration, 1)
      }
    };
  }

  private async buildContent(request: GenerationRequest): Promise<ContentItem[]> {
    const content: ContentItem[] = [{ type: "text", text: request.prompt }];
    if (request.mode === "video") {
      if (!request.sourceVideoPath) throw new Error("视频生视频模式必须选择源视频。 ");
      content.push({ type: "video_url", video_url: { url: await dataUri(request.sourceVideoPath) }, role: "reference_video" });
      return content;
    }
    if (request.mode === "image" && request.sourceImagePath) {
      content.push({ type: "image_url", image_url: { url: await dataUri(request.sourceImagePath) }, role: "first_frame" });
    }
    if (request.firstFramePath) {
      content.push({ type: "image_url", image_url: { url: await dataUri(request.firstFramePath) }, role: "first_frame" });
    }
    if (request.lastFramePath) {
      content.push({ type: "image_url", image_url: { url: await dataUri(request.lastFramePath) }, role: "last_frame" });
    }
    return content;
  }

  private async wait(
    taskId: string,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<{ url: string; inputSeconds?: number; outputSeconds?: number }> {
    let progress = 15;
    for (;;) {
      const response = await fetch(`${this.baseUrl}/v2/query/video_generation/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        signal
      });
      const payload = (await response.json()) as {
        task?: {
          status?: string;
          content?: { url?: string };
          usage?: { input_seconds?: number; output_seconds?: number };
          error?: { message?: string };
        };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || `查询失败：${response.status}`);
      if (payload.task?.status === "succeeded" && payload.task.content?.url) {
        return {
          url: payload.task.content.url,
          inputSeconds: payload.task.usage?.input_seconds,
          outputSeconds: payload.task.usage?.output_seconds
        };
      }
      if (payload.task?.status === "failed" || payload.task?.status === "cancelled") {
        throw new Error(payload.task.error?.message || `任务${payload.task.status}`);
      }
      progress = Math.min(92, progress + 3);
      onProgress("running", progress, payload.task?.status === "queued" ? "云端排队中" : "MiniMax H3 正在生成");
      await delay(10_000, signal);
    }
  }

  private async download(url: string, taskId: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`生成结果下载失败：${response.status}`);
    await mkdir(this.options.outputDirectory, { recursive: true });
    const target = path.join(this.options.outputDirectory, `${taskId}.mp4`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    return target;
  }
}

async function dataUri(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime"
  };
  const bytes = await readFile(filePath);
  if (bytes.byteLength > 50 * 1024 * 1024) throw new Error("参考素材超过云 API 允许的 50MB，请改用公网 URL 或压缩文件。 ");
  return `data:${mime[extension] || "application/octet-stream"};base64,${bytes.toString("base64")}`;
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
