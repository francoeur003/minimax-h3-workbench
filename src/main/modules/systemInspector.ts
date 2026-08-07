import { execFile } from "node:child_process";
import { promisify } from "node:util";
import si from "systeminformation";
import { classifyEnvironment } from "../../shared/capabilities";
import type { EnvironmentReport, GpuInfo } from "../../shared/types";

const execFileAsync = promisify(execFile);

export async function inspectEnvironment(comfyUrl: string): Promise<EnvironmentReport> {
  const [osInfo, cpu, memory, graphics, fileSystems, comfy, ffmpegAvailable] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
    si.graphics(),
    si.fsSize(),
    inspectComfy(comfyUrl),
    hasFfmpeg()
  ]);

  const gpus: GpuInfo[] = graphics.controllers.map((gpu) => ({
    vendor: gpu.vendor || "Unknown",
    model: gpu.model || "Unknown GPU",
    vramBytes: Number(gpu.vram || 0) * 1024 * 1024
  }));
  const disk = fileSystems.find((item) => item.mount === "/") ?? fileSystems[0];
  const diskFreeBytes = disk ? Number(disk.size - disk.used) : 0;
  const capability = classifyEnvironment({
    gpus,
    memoryTotalBytes: memory.total,
    diskFreeBytes,
    comfyReachable: comfy.reachable,
    comfyHasH3Nodes: comfy.hasH3Nodes
  });

  return {
    checkedAt: new Date().toISOString(),
    os: `${osInfo.distro} ${osInfo.release}`,
    arch: osInfo.arch,
    cpu: cpu.brand,
    cpuCores: cpu.physicalCores || cpu.cores,
    memoryTotalBytes: memory.total,
    memoryAvailableBytes: memory.available,
    diskFreeBytes,
    gpus,
    comfyReachable: comfy.reachable,
    comfyVersion: comfy.version,
    comfyHasH3Nodes: comfy.hasH3Nodes,
    ffmpegAvailable,
    ...capability
  };
}

async function inspectComfy(baseUrl: string): Promise<{ reachable: boolean; version?: string; hasH3Nodes: boolean }> {
  try {
    const [statsResponse, nodeResponse] = await Promise.all([
      fetch(`${baseUrl.replace(/\/$/, "")}/system_stats`, { signal: AbortSignal.timeout(4_000) }),
      fetch(`${baseUrl.replace(/\/$/, "")}/object_info`, { signal: AbortSignal.timeout(8_000) })
    ]);
    if (!statsResponse.ok || !nodeResponse.ok) return { reachable: false, hasH3Nodes: false };
    const stats = (await statsResponse.json()) as { system?: { comfyui_version?: string } };
    const nodes = (await nodeResponse.json()) as Record<string, unknown>;
    return {
      reachable: true,
      version: stats.system?.comfyui_version,
      hasH3Nodes: "MiniMaxH3ImageToVideo" in nodes && "MiniMaxH3ReferenceToVideo" in nodes
    };
  } catch {
    return { reachable: false, hasH3Nodes: false };
  }
}

async function hasFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}
