export type BackendKind = "local" | "ssh" | "minimax" | "seedance";
export type SecretName = "minimaxApiKey" | "seedanceUsername" | "seedancePassword" | "sshPassword";
export type GenerationMode = "text" | "image" | "video";
export type TaskStatus =
  | "draft"
  | "validating"
  | "uploading"
  | "queued"
  | "running"
  | "decoding"
  | "downloading"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface AppSettings {
  localComfyUrl: string;
  outputDirectory: string;
  defaultBackend: BackendKind;
  minimaxBaseUrl: string;
  seedanceBaseUrl: string;
  ssh: {
    name: string;
    host: string;
    port: number;
    username: string;
    privateKeyPath: string;
    hostFingerprint: string;
    remoteComfyHost: string;
    remoteComfyPort: number;
    remoteComfyPath: string;
  };
}

export interface GpuInfo {
  vendor: string;
  model: string;
  vramBytes: number;
}

export interface EnvironmentReport {
  checkedAt: string;
  os: string;
  arch: string;
  cpu: string;
  cpuCores: number;
  memoryTotalBytes: number;
  memoryAvailableBytes: number;
  diskFreeBytes: number;
  gpus: GpuInfo[];
  comfyReachable: boolean;
  comfyVersion?: string;
  comfyHasH3Nodes: boolean;
  ffmpegAvailable: boolean;
  grade: "A" | "B" | "C" | "D";
  verdict: string;
  recommendations: string[];
}

export interface ResourceLink {
  id: string;
  label: string;
  category: "model" | "comfyui" | "workflow" | "docs";
  url: string;
  description: string;
  action: "download" | "open";
  sizeBytes?: number;
  targetDirectory?: string;
}

export interface GenerationRequest {
  mode: GenerationMode;
  backend: BackendKind;
  prompt: string;
  duration: number;
  ratio: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "adaptive";
  resolution: "768P" | "2K";
  width: number;
  height: number;
  count: number;
  baseSeed: number;
  firstFramePath?: string;
  lastFramePath?: string;
  sourceImagePath?: string;
  sourceVideoPath?: string;
}

export interface GenerationTask {
  id: string;
  parentId: string;
  index: number;
  seed: number;
  backend: BackendKind;
  mode: GenerationMode;
  status: TaskStatus;
  progress: number;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  providerTaskId?: string;
  outputPath?: string;
  outputUrl?: string;
  errorCode?: string;
  message?: string;
  usage?: {
    inputSeconds?: number;
    outputSeconds?: number;
    estimatedUsd?: number;
  };
}

export interface BackendTestResult {
  ok: boolean;
  label: string;
  latencyMs: number;
  details: Record<string, unknown>;
  message: string;
}

export interface GenerationAdapter {
  test(signal?: AbortSignal): Promise<BackendTestResult>;
  generate(
    request: GenerationRequest,
    task: GenerationTask,
    onProgress: (status: TaskStatus, progress: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<Pick<GenerationTask, "providerTaskId" | "outputPath" | "outputUrl" | "usage">>;
  cancel?(providerTaskId: string): Promise<void>;
}

export interface ApiResponse<T> {
  ok: boolean;
  requestId: string;
  data?: T;
  warnings?: string[];
  errorCode?: string;
  message?: string;
  retryable?: boolean;
}

export interface WorkbenchApi {
  getSettings(): Promise<ApiResponse<AppSettings>>;
  updateSettings(patch: Partial<AppSettings>): Promise<ApiResponse<AppSettings>>;
  setSecret(name: SecretName, value: string): Promise<ApiResponse<boolean>>;
  hasSecret(name: SecretName): Promise<ApiResponse<boolean>>;
  selectDirectory(): Promise<ApiResponse<string | undefined>>;
  selectFile(kind: "image" | "video" | "key"): Promise<ApiResponse<string | undefined>>;
  inspectEnvironment(): Promise<ApiResponse<EnvironmentReport>>;
  getResourceLinks(): Promise<ApiResponse<ResourceLink[]>>;
  testBackend(kind: BackendKind): Promise<ApiResponse<BackendTestResult>>;
  listTasks(): Promise<ApiResponse<GenerationTask[]>>;
  submitGeneration(request: GenerationRequest): Promise<ApiResponse<GenerationTask[]>>;
  cancelTask(taskId: string): Promise<ApiResponse<GenerationTask>>;
  showItem(filePath: string): Promise<ApiResponse<boolean>>;
  openExternal(url: string): Promise<ApiResponse<boolean>>;
  onTaskUpdate(listener: (task: GenerationTask) => void): () => void;
}
