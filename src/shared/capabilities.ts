import type { EnvironmentReport, GpuInfo } from "./types";

export interface CapabilityInput {
  gpus: GpuInfo[];
  memoryTotalBytes: number;
  diskFreeBytes: number;
  comfyReachable: boolean;
  comfyHasH3Nodes: boolean;
}

export interface LocalRuntimeEstimate {
  resolution: "720P" | "2K";
  minMinutes: number;
  maxMinutes: number;
  risk: "medium" | "high" | "very_high";
  note: string;
}

const GiB = 1024 ** 3;

export function classifyEnvironment(input: CapabilityInput): Pick<EnvironmentReport, "grade" | "verdict" | "recommendations"> {
  const nvidia = input.gpus.filter((gpu) => /nvidia/i.test(`${gpu.vendor} ${gpu.model}`));
  const appleGpu = input.gpus.some((gpu) => /apple/i.test(`${gpu.vendor} ${gpu.model}`));
  const totalVram = nvidia.reduce((sum, gpu) => sum + gpu.vramBytes, 0);
  const recommendations: string[] = [];

  if (input.diskFreeBytes < 70 * GiB) recommendations.push("至少释放 70GB 磁盘空间后再安装完整创作包。 ");

  if (nvidia.length >= 2 && totalVram >= 48 * GiB && input.memoryTotalBytes >= 256 * GiB) {
    if (!input.comfyReachable) recommendations.push("安装或启动 ComfyUI 0.30.0+，然后重新检测。 ");
    if (input.comfyReachable && !input.comfyHasH3Nodes) recommendations.push("更新 ComfyUI，当前实例缺少 MiniMax H3 原生节点。 ");
    return {
      grade: "B",
      verdict: "硬件接近官方验证的本地配置，完成模型安装后可运行预检。",
      recommendations
    };
  }

  if (nvidia.length >= 1 && totalVram >= 12 * GiB && input.memoryTotalBytes >= 32 * GiB && input.diskFreeBytes >= 45 * GiB) {
    if (!input.comfyReachable) recommendations.push("安装或启动 ComfyUI 0.30.0+，然后重新检测。 ");
    if (input.comfyReachable && !input.comfyHasH3Nodes) recommendations.push("更新 ComfyUI，当前实例缺少 MiniMax H3 原生节点。 ");
    recommendations.push("该配置属于 ComfyUI 量化实验路径，必须通过 5 秒预检后才标记为可用。 ");
    return {
      grade: "C",
      verdict: "可以尝试本地量化运行，但不属于官方保证配置。",
      recommendations
    };
  }

  recommendations.push("不建议继续配置本机生成；优先使用 SSH 远程显卡或 MiniMax 云 API。 ");
  recommendations.push("如仍要强行本机运行，请先做单条 5 秒 720P 预检，并预留失败或内存溢出的可能。 ");
  return {
    grade: "D",
    verdict: appleGpu
      ? "本机不建议运行 MiniMax H3：Apple GPU 不属于当前验证的 NVIDIA CUDA 路径。"
      : "本机不建议运行 MiniMax H3：当前硬件低于量化实验配置。",
    recommendations
  };
}

export function estimateLocalRuntime(
  input: Pick<EnvironmentReport, "gpus" | "memoryTotalBytes">
): LocalRuntimeEstimate[] {
  const nvidia = input.gpus.filter((gpu) => /nvidia/i.test(`${gpu.vendor} ${gpu.model}`));
  const totalVram = nvidia.reduce((sum, gpu) => sum + gpu.vramBytes, 0);
  const appleDescription = input.gpus.map((gpu) => `${gpu.vendor} ${gpu.model}`).join(" ");
  const isAppleMax = /apple.*(?:m[1-9].*)?max/i.test(appleDescription);

  if (nvidia.length >= 2 && totalVram >= 48 * GiB) {
    return runtimeRanges([10, 25], [45, 120], "medium", "多卡通信、工作流和参考素材会明显影响速度。");
  }
  if (totalVram >= 24 * GiB) {
    return runtimeRanges([6, 15], [35, 90], "high", "2K 会触发显存卸载，实际时间可能继续增加。");
  }
  if (totalVram >= 16 * GiB) {
    return runtimeRanges([10, 25], [60, 150], "high", "需要 INT8/AWQ 与动态显存卸载；2K 有失败风险。");
  }
  if (totalVram >= 12 * GiB) {
    return runtimeRanges([15, 40], [120, 300], "very_high", "仅建议量化预检；2K 很可能内存溢出。");
  }
  if (isAppleMax && input.memoryTotalBytes >= 64 * GiB) {
    return runtimeRanges([45, 90], [180, 360], "very_high", "MPS 路径未经充分验证；2K 可能失败，且会长时间占满统一内存。");
  }
  if (/apple/i.test(appleDescription) && input.memoryTotalBytes >= 48 * GiB) {
    return runtimeRanges([60, 150], [300, 720], "very_high", "MPS 路径未经充分验证；2K 极易进入交换内存或失败。");
  }
  return runtimeRanges([120, 360], [480, 1_440], "very_high", "当前设备缺少合适的 CUDA 显卡，运行可能失败而无法产出视频。");
}

function runtimeRanges(
  hd: [number, number],
  twoK: [number, number],
  risk: LocalRuntimeEstimate["risk"],
  note: string
): LocalRuntimeEstimate[] {
  return [
    { resolution: "720P", minMinutes: hd[0], maxMinutes: hd[1], risk, note },
    { resolution: "2K", minMinutes: twoK[0], maxMinutes: twoK[1], risk: risk === "medium" ? "high" : "very_high", note }
  ];
}

export function estimateCloudCost(resolution: "768P" | "2K", duration: number, count: number): number {
  const perSecond = resolution === "2K" ? 0.13 : 0.08;
  return Number((perSecond * duration * count).toFixed(2));
}
