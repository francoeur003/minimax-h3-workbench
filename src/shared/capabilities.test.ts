import { describe, expect, it } from "vitest";
import { classifyEnvironment, estimateCloudCost, estimateLocalRuntime } from "./capabilities";

const GiB = 1024 ** 3;

describe("classifyEnvironment", () => {
  it("recommends SSH or cloud when there is no NVIDIA GPU", () => {
    const result = classifyEnvironment({
      gpus: [{ vendor: "Apple", model: "M4", vramBytes: 32 * GiB }],
      memoryTotalBytes: 32 * GiB,
      diskFreeBytes: 100 * GiB,
      comfyReachable: false,
      comfyHasH3Nodes: false
    });
    expect(result.grade).toBe("D");
    expect(result.recommendations.join(" ")).toContain("SSH");
    expect(result.verdict).toContain("本机不建议运行");
  });

  it("classifies a 24GB NVIDIA workstation as an experimental local path", () => {
    const result = classifyEnvironment({
      gpus: [{ vendor: "NVIDIA", model: "RTX 4090", vramBytes: 24 * GiB }],
      memoryTotalBytes: 64 * GiB,
      diskFreeBytes: 100 * GiB,
      comfyReachable: true,
      comfyHasH3Nodes: true
    });
    expect(result.grade).toBe("C");
  });
});

describe("estimateLocalRuntime", () => {
  it("shows high-risk 720P and 2K ranges for an Apple M3 Max with 64GB memory", () => {
    const estimates = estimateLocalRuntime({
      gpus: [{ vendor: "Apple", model: "Apple M3 Max", vramBytes: 0 }],
      memoryTotalBytes: 64 * GiB
    });
    expect(estimates).toEqual([
      expect.objectContaining({ resolution: "720P", minMinutes: 45, maxMinutes: 90, risk: "very_high" }),
      expect.objectContaining({ resolution: "2K", minMinutes: 180, maxMinutes: 360, risk: "very_high" })
    ]);
  });

  it("gives a faster but still cautious range to a 24GB NVIDIA GPU", () => {
    const estimates = estimateLocalRuntime({
      gpus: [{ vendor: "NVIDIA", model: "RTX 4090", vramBytes: 24 * GiB }],
      memoryTotalBytes: 64 * GiB
    });
    expect(estimates[0]).toMatchObject({ resolution: "720P", minMinutes: 6, maxMinutes: 15 });
    expect(estimates[1]).toMatchObject({ resolution: "2K", minMinutes: 35, maxMinutes: 90 });
  });
});

describe("estimateCloudCost", () => {
  it("scales with duration and output count", () => {
    expect(estimateCloudCost("768P", 10, 4)).toBe(3.2);
    expect(estimateCloudCost("2K", 10, 4)).toBe(5.2);
  });
});
