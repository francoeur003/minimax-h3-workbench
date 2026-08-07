import { describe, expect, it } from "vitest";
import { classifyEnvironment, estimateCloudCost } from "./capabilities";

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

describe("estimateCloudCost", () => {
  it("scales with duration and output count", () => {
    expect(estimateCloudCost("768P", 10, 4)).toBe(3.2);
    expect(estimateCloudCost("2K", 10, 4)).toBe(5.2);
  });
});
