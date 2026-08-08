import { randomUUID } from "node:crypto";
import type { GenerationRequest, GenerationTask, TaskStatus } from "../../shared/types";
import { AdapterRegistry } from "../backends/adapterRegistry";
import { TaskStore } from "./taskStore";

type TaskListener = (task: GenerationTask) => void;

export class GenerationOrchestrator {
  private tasks: GenerationTask[] = [];
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly store: TaskStore,
    private readonly adapters: AdapterRegistry,
    private readonly listener: TaskListener
  ) {}

  async initialize(): Promise<void> {
    this.tasks = await this.store.load();
  }

  list(): GenerationTask[] {
    return [...this.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async submit(request: GenerationRequest): Promise<GenerationTask[]> {
    validateRequest(request);
    const parentId = randomUUID();
    const now = new Date().toISOString();
    const count = Math.max(1, Math.min(4, Math.round(request.count || 4)));
    const created = Array.from({ length: count }, (_, index): GenerationTask => ({
      id: randomUUID(),
      parentId,
      index,
      seed: request.baseSeed + index,
      backend: request.backend,
      mode: request.mode,
      status: "queued",
      progress: 0,
      prompt: request.prompt.trim(),
      createdAt: now,
      updatedAt: now,
      message: "等待生成"
    }));
    this.tasks.unshift(...created);
    await this.store.save(this.tasks);
    created.forEach(this.listener);

    const concurrency = request.backend === "seedance" ? 4 : request.backend === "minimax" ? 2 : 1;
    void runPool(created, concurrency, (task) => this.runTask(request, task));
    return created;
  }

  async cancel(taskId: string): Promise<GenerationTask> {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error("任务不存在。");
    this.controllers.get(taskId)?.abort();
    if (task.providerTaskId) {
      const adapter = await this.adapters.get(task.backend);
      await adapter.cancel?.(task.providerTaskId).catch(() => undefined);
    }
    return this.update(task, "cancelled", task.progress, "已取消");
  }

  private async runTask(request: GenerationRequest, task: GenerationTask): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(task.id, controller);
    try {
      this.update(task, "validating", 2, "正在校验参数与连接");
      const adapter = await this.adapters.get(request.backend);
      const result = await adapter.generate(
        request,
        task,
        (status, progress, message) => this.update(task, status, progress, message),
        controller.signal
      );
      Object.assign(task, result);
      this.update(task, "succeeded", 100, "生成完成");
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      this.update(task, cancelled ? "cancelled" : "failed", task.progress, cancelled ? "已取消" : messageOf(error));
      if (!cancelled) task.errorCode = "GENERATION_FAILED";
    } finally {
      this.controllers.delete(task.id);
      await this.store.save(this.tasks);
    }
  }

  private update(task: GenerationTask, status: TaskStatus, progress: number, message?: string): GenerationTask {
    task.status = status;
    task.progress = Math.max(0, Math.min(100, Math.round(progress)));
    task.updatedAt = new Date().toISOString();
    task.message = message;
    this.listener({ ...task });
    void this.store.save(this.tasks);
    return task;
  }
}

function validateRequest(request: GenerationRequest): void {
  if (!request.prompt?.trim()) throw new Error("请输入视频描述。");
  if (request.duration < 4 || request.duration > 15) throw new Error("视频时长必须在 4–15 秒之间。");
  if (request.mode === "image" && !request.sourceImagePath && !request.firstFramePath) {
    throw new Error("图生视频模式必须选择一张图片。");
  }
  if (request.mode === "video" && !request.sourceVideoPath) throw new Error("视频生视频模式必须选择源视频。");
  if (request.lastFramePath && !request.firstFramePath) throw new Error("使用尾帧时必须同时设置首帧。");
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        if (item) await worker(item);
      }
    })
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "生成失败，请检查连接与参数。";
}
