import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BackendTestResult,
  GenerationAdapter,
  GenerationRequest,
  GenerationTask,
  TaskStatus
} from "../../shared/types";
import { inspectH3Readiness } from "./comfyReadiness";
import { buildFl2vaWorkflow, buildRef2vaWorkflow, type ComfyPrompt, type UploadedMedia } from "./workflows";

interface ComfyAdapterOptions {
  baseUrl: string;
  outputDirectory: string;
}

type JsonObject = Record<string, unknown>;

export class ComfyAdapter implements GenerationAdapter {
  private readonly baseUrl: string;

  constructor(private readonly options: ComfyAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async test(signal?: AbortSignal): Promise<BackendTestResult> {
    const start = Date.now();
    try {
      const [statsResponse, nodesResponse] = await Promise.all([
        fetch(`${this.baseUrl}/system_stats`, { signal: signal ?? AbortSignal.timeout(8_000) }),
        fetch(`${this.baseUrl}/object_info`, { signal: signal ?? AbortSignal.timeout(12_000) })
      ]);
      if (!statsResponse.ok || !nodesResponse.ok) throw new Error(`ComfyUI 返回 ${statsResponse.status}/${nodesResponse.status}`);
      const stats = (await statsResponse.json()) as Record<string, unknown>;
      const nodes = (await nodesResponse.json()) as JsonObject;
      const { hasH3Nodes: hasH3, missingModels: missing } = inspectH3Readiness(nodes);
      const ok = hasH3 && missing.length === 0;
      return {
        ok,
        label: "ComfyUI",
        latencyMs: Date.now() - start,
        details: {
          stats,
          hasH3,
          missingModels: missing.map((item) => item.name),
          missingModelPaths: missing.map((item) => `${item.directory}${item.name}`)
        },
        message: !hasH3
          ? "ComfyUI 已连接，但缺少 H3 原生节点，请更新到 0.30.0+。"
          : missing.length > 0
            ? `ComfyUI 已连接，但缺少 ${missing.length} 个 H3 模型文件。请进入“模型下载”按标注目录安装。`
            : "ComfyUI 已连接，H3 节点与 5 个模型文件均已就绪。"
      };
    } catch (error) {
      return {
        ok: false,
        label: "ComfyUI",
        latencyMs: Date.now() - start,
        details: {},
        message: error instanceof Error ? error.message : "无法连接 ComfyUI"
      };
    }
  }

  async generate(
    request: GenerationRequest,
    task: GenerationTask,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<Pick<GenerationTask, "providerTaskId" | "outputPath" | "outputUrl" | "usage">> {
    await this.assertModelsReady(request.mode, signal);
    onProgress("uploading", 5, "正在准备参考素材");
    const workflow = await this.prepareWorkflow(request, task.seed, signal);
    onProgress("queued", 10, "正在提交 ComfyUI 队列");
    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: task.id }),
      signal
    });
    if (!response.ok) throw new Error(`ComfyUI 提交失败：${response.status} ${await response.text()}`);
    const submitted = (await response.json()) as { prompt_id?: string; error?: { message?: string } };
    if (!submitted.prompt_id) throw new Error(submitted.error?.message || "ComfyUI 未返回 prompt_id");
    onProgress("running", 15, "ComfyUI 正在生成");

    const output = await this.waitForOutput(submitted.prompt_id, onProgress, signal);
    onProgress("downloading", 94, "正在保存生成结果");
    const outputPath = await this.downloadOutput(output, task.id, signal);
    onProgress("succeeded", 100, "生成完成");
    return { providerTaskId: submitted.prompt_id, outputPath };
  }

  async cancel(_providerTaskId?: string): Promise<void> {
    await fetch(`${this.baseUrl}/interrupt`, { method: "POST" });
  }

  private async assertModelsReady(mode: GenerationRequest["mode"], signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.baseUrl}/object_info`, { signal: signal ?? AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`无法读取 ComfyUI 模型清单：HTTP ${response.status}`);
    const nodes = (await response.json()) as JsonObject;
    const readiness = inspectH3Readiness(nodes);
    if (!readiness.hasH3Nodes) throw new Error("当前 ComfyUI 缺少 MiniMax H3 原生节点，请更新到 0.30.0+ 后完全重启。 ");
    const requiredKeys = mode === "video"
      ? new Set(["ref2va", "clip", "videoVae", "audioVae"])
      : new Set(["fl2va", "clip", "videoVae", "audioVae"]);
    const missing = readiness.missingModels.filter((item) => requiredKeys.has(item.key));
    if (missing.length === 0) return;
    const list = missing.map((item) => `${item.name} → ${item.directory}`).join("；");
    throw new Error(`缺少本次生成所需的 H3 模型：${list}。安装后请完全重启 ComfyUI。`);
  }

  private async prepareWorkflow(request: GenerationRequest, seed: number, signal?: AbortSignal): Promise<ComfyPrompt> {
    if (request.mode === "video") {
      if (!request.sourceVideoPath) throw new Error("视频生视频模式必须选择源视频。 ");
      const sourceVideo = await this.upload(request.sourceVideoPath, signal);
      return buildRef2vaWorkflow(request, seed, { sourceVideo });
    }
    const [first, last, sourceImage] = await Promise.all([
      request.firstFramePath ? this.upload(request.firstFramePath, signal) : undefined,
      request.lastFramePath ? this.upload(request.lastFramePath, signal) : undefined,
      request.sourceImagePath ? this.upload(request.sourceImagePath, signal) : undefined
    ]);
    return buildFl2vaWorkflow(request, seed, { first, last, sourceImage });
  }

  private async upload(filePath: string, signal?: AbortSignal): Promise<UploadedMedia> {
    const bytes = await BunlessFile.read(filePath);
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(bytes)]), path.basename(filePath));
    form.append("type", "input");
    form.append("overwrite", "true");
    const response = await fetch(`${this.baseUrl}/upload/image`, { method: "POST", body: form, signal });
    if (!response.ok) throw new Error(`素材上传失败：${response.status} ${await response.text()}`);
    return (await response.json()) as UploadedMedia;
  }

  private async waitForOutput(
    promptId: string,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<{ filename: string; subfolder?: string; type?: string }> {
    let progress = 18;
    for (;;) {
      if (signal?.aborted) throw new DOMException("任务已取消", "AbortError");
      const response = await fetch(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
      if (response.ok) {
        const history = (await response.json()) as Record<string, unknown>;
        const entry = history[promptId] as { outputs?: unknown; status?: { status_str?: string; messages?: unknown[] } } | undefined;
        if (entry?.status?.status_str === "error") throw new Error(`ComfyUI 任务失败：${JSON.stringify(entry.status.messages ?? [])}`);
        const output = findMedia(entry?.outputs);
        if (output) return output;
      }
      progress = Math.min(90, progress + 2);
      onProgress("running", progress, "模型正在采样和解码");
      await delay(3_000, signal);
    }
  }

  private async downloadOutput(
    output: { filename: string; subfolder?: string; type?: string },
    taskId: string,
    signal?: AbortSignal
  ): Promise<string> {
    await mkdir(this.options.outputDirectory, { recursive: true });
    const extension = path.extname(output.filename) || ".mp4";
    const target = path.join(this.options.outputDirectory, `${taskId}${extension}`);
    const query = new URLSearchParams({
      filename: output.filename,
      subfolder: output.subfolder || "",
      type: output.type || "output"
    });
    const response = await fetch(`${this.baseUrl}/view?${query.toString()}`, { signal });
    if (!response.ok) throw new Error(`结果下载失败：${response.status}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    return target;
  }
}

function findMedia(value: unknown): { filename: string; subfolder?: string; type?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.filename === "string") return record as { filename: string; subfolder?: string; type?: string };
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findMedia(item);
        if (found) return found;
      }
    } else {
      const found = findMedia(child);
      if (found) return found;
    }
  }
  return undefined;
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

class BunlessFile {
  static async read(filePath: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(filePath)) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
}
