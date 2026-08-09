import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationRequest, GenerationTask } from "../../shared/types";
import { ComfyAdapter } from "./comfyAdapter";

const request: GenerationRequest = {
  mode: "text",
  backend: "local",
  prompt: "A cinematic tracking shot",
  duration: 4,
  ratio: "16:9",
  resolution: "768P",
  width: 1280,
  height: 720,
  count: 4,
  baseSeed: 42
};

const task: GenerationTask = {
  id: "task-1",
  parentId: "group-1",
  index: 0,
  seed: 42,
  backend: "local",
  mode: "text",
  status: "queued",
  progress: 0,
  prompt: request.prompt,
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z"
};

afterEach(() => vi.unstubAllGlobals());

describe("ComfyAdapter readiness", () => {
  it("reports the exact missing H3 models instead of a false successful connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/system_stats")) return json({ system: { comfyui_version: "0.31.0" } });
      if (url.endsWith("/object_info")) return json(objectInfo({
        diffusion: [],
        textEncoders: [],
        vaes: []
      }));
      throw new Error(`Unexpected request: ${url}`);
    }));

    const result = await adapter().test();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("缺少 5 个 H3 模型文件");
    expect(result.details.missingModels).toEqual([
      "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
      "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
      "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
      "minimax_h3_video_vae_fp16.safetensors",
      "minimax_h3_audio_vae_fp32.safetensors"
    ]);
  });

  it("accepts a complete H3 installation", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/system_stats")) return json({ system: { comfyui_version: "0.31.0" } });
      if (url.endsWith("/object_info")) return json(objectInfo({
        diffusion: [
          "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
          "minimax_h3_ref2va_pruned_int8_convrot.safetensors"
        ],
        textEncoders: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"],
        vaes: ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"]
      }));
      throw new Error(`Unexpected request: ${url}`);
    }));

    const result = await adapter().test();

    expect(result.ok).toBe(true);
    expect(result.message).toContain("节点与 5 个模型文件均已就绪");
  });

  it("blocks generation before /prompt when the required model is missing", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/object_info")) return json(objectInfo({
        diffusion: [],
        textEncoders: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"],
        vaes: ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"]
      }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter().generate(request, task, () => undefined)).rejects.toThrow(
      "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
    );
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/prompt"))).toBe(false);
  });
});

function adapter(): ComfyAdapter {
  return new ComfyAdapter({ baseUrl: "http://127.0.0.1:8188", outputDirectory: "/tmp" });
}

function objectInfo(files: { diffusion: string[]; textEncoders: string[]; vaes: string[] }) {
  return {
    MiniMaxH3ImageToVideo: {},
    MiniMaxH3ReferenceToVideo: {},
    UNETLoader: { input: { required: { unet_name: [files.diffusion] } } },
    CLIPLoader: { input: { required: { clip_name: [files.textEncoders] } } },
    VAELoader: { input: { required: { vae_name: [files.vaes] } } }
  };
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
