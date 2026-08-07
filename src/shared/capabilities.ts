import type { EnvironmentReport, GpuInfo } from "./types";

export interface CapabilityInput {
  gpus: GpuInfo[];
  memoryTotalBytes: number;
  diskFreeBytes: number;
  comfyReachable: boolean;
  comfyHasH3Nodes: boolean;
}

const GiB = 1024 ** 3;

export function classifyEnvironment(input: CapabilityInput): Pick<EnvironmentReport, "grade" | "verdict" | "recommendations"> {
  const nvidia = input.gpus.filter((gpu) => /nvidia/i.test(`${gpu.vendor} ${gpu.model}`));
  const totalVram = nvidia.reduce((sum, gpu) => sum + gpu.vramBytes, 0);
  const recommendations: string[] = [];

  if (input.diskFreeBytes < 70 * GiB) recommendations.push("至少释放 70GB 磁盘空间后再安装完整创作包。 ");
  if (!input.comfyReachable) recommendations.push("安装或启动 ComfyUI 0.30.0+，然后重新检测。 ");
  if (input.comfyReachable && !input.comfyHasH3Nodes) recommendations.push("更新 ComfyUI，当前实例缺少 MiniMax H3 原生节点。 ");

  if (nvidia.length >= 2 && totalVram >= 48 * GiB && input.memoryTotalBytes >= 256 * GiB) {
    return {
      grade: "B",
      verdict: "硬件接近官方验证的本地配置，完成模型安装后可运行预检。",
      recommendations
    };
  }

  if (nvidia.length >= 1 && totalVram >= 12 * GiB && input.memoryTotalBytes >= 32 * GiB && input.diskFreeBytes >= 45 * GiB) {
    recommendations.push("该配置属于 ComfyUI 量化实验路径，必须通过 5 秒预检后才标记为可用。 ");
    return {
      grade: "C",
      verdict: "可以尝试本地量化运行，但不属于官方保证配置。",
      recommendations
    };
  }

  recommendations.push("建议使用 SSH 远程显卡或 MiniMax 云 API。 ");
  return {
    grade: "D",
    verdict: "当前配置不建议直接在本机运行 MiniMax H3。",
    recommendations
  };
}

export function estimateCloudCost(resolution: "768P" | "2K", duration: number, count: number): number {
  const perSecond = resolution === "2K" ? 0.13 : 0.08;
  return Number((perSecond * duration * count).toFixed(2));
}
