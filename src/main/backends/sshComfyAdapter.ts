import type {
  AppSettings,
  BackendTestResult,
  GenerationAdapter,
  GenerationRequest,
  GenerationTask,
  TaskStatus
} from "../../shared/types";
import { ComfyAdapter } from "./comfyAdapter";
import { SshTunnel } from "./sshTunnel";

export class SshComfyAdapter implements GenerationAdapter {
  private readonly tunnel: SshTunnel;
  private delegate?: ComfyAdapter;

  constructor(settings: AppSettings, sshPassword: string) {
    this.tunnel = new SshTunnel(settings.ssh, sshPassword);
    this.settings = settings;
  }

  private readonly settings: AppSettings;

  async test(signal?: AbortSignal): Promise<BackendTestResult> {
    const start = Date.now();
    try {
      const tunnel = await this.tunnel.start();
      const hardware = await this.tunnel.exec(
        "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>/dev/null || true; free -h 2>/dev/null | head -2; df -h . | tail -1"
      );
      this.delegate = new ComfyAdapter({ baseUrl: tunnel.url, outputDirectory: this.settings.outputDirectory });
      const comfy = await this.delegate.test(signal);
      return {
        ...comfy,
        label: "SSH 远程 ComfyUI",
        latencyMs: Date.now() - start,
        details: { ...comfy.details, fingerprint: tunnel.fingerprint, hardware: hardware.stdout.trim() },
        message: comfy.ok ? "SSH 隧道和远程 H3 ComfyUI 均已就绪。" : comfy.message
      };
    } catch (error) {
      return {
        ok: false,
        label: "SSH 远程 ComfyUI",
        latencyMs: Date.now() - start,
        details: {},
        message: error instanceof Error ? error.message : "SSH 连接失败"
      };
    }
  }

  async generate(
    request: GenerationRequest,
    task: GenerationTask,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<Pick<GenerationTask, "providerTaskId" | "outputPath" | "outputUrl" | "usage">> {
    if (!this.delegate) {
      const tunnel = await this.tunnel.start();
      this.delegate = new ComfyAdapter({ baseUrl: tunnel.url, outputDirectory: this.settings.outputDirectory });
    }
    return this.delegate.generate(request, task, onProgress, signal);
  }

  async cancel(providerTaskId: string): Promise<void> {
    await this.delegate?.cancel?.(providerTaskId);
  }

  close(): void {
    this.tunnel.close();
  }
}
