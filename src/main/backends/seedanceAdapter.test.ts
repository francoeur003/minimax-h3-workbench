import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationRequest, GenerationTask } from "../../shared/types";
import { SeedanceAdapter } from "./seedanceAdapter";

const request: GenerationRequest = {
  mode: "text",
  backend: "seedance",
  prompt: "A glass sphere pulses with magenta light",
  duration: 4,
  ratio: "16:9",
  resolution: "768P",
  width: 864,
  height: 496,
  count: 4,
  baseSeed: 100
};

const task: GenerationTask = {
  id: "local-task-1",
  parentId: "group-1",
  index: 0,
  seed: 100,
  backend: "seedance",
  mode: "text",
  status: "queued",
  progress: 0,
  prompt: request.prompt,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z"
};

afterEach(() => vi.unstubAllGlobals());

describe("SeedanceAdapter", () => {
  it("tests the account connection without exposing credentials", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/login")) return json({ data: { access_token: "console-token" } });
      if (url.endsWith("/user/profile")) return json({ data: { wallet_balance: "306783", max_concurrent: 50 } });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new SeedanceAdapter({
      baseUrl: "https://example.test",
      username: "demo-user",
      password: "demo-pass",
      outputDirectory: os.tmpdir()
    });
    const result = await adapter.test();

    expect(result.ok).toBe(true);
    expect(result.message).toContain("306783");
    expect(result.details.maxConcurrent).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("submits, polls and downloads a four-second text-to-video result", async () => {
    const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "seedance-adapter-"));
    const progress: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/login")) return json({ token: "console-token" });
      if (url.endsWith("/console/api_key/list")) return json({ data: { records: [{ api_key: "api-key" }] } });
      if (url.endsWith("/contents/generations/tasks") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({
          model: "doubao-seedance-2-0-260128",
          resolution: "480p",
          ratio: "16:9",
          duration: 4,
          generate_audio: true,
          content: [{ type: "text", text: request.prompt }]
        });
        return json({ id: "provider-task-1", status: "queued" });
      }
      if (url.endsWith("/contents/generations/tasks/provider-task-1")) {
        return json({ id: "provider-task-1", status: "succeeded", content: { video_url: "https://media.test/result.mp4" } });
      }
      if (url === "https://media.test/result.mp4") return new Response(new Uint8Array([0, 1, 2, 3]), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const adapter = new SeedanceAdapter({
        baseUrl: "https://example.test/",
        username: "demo-user",
        password: "demo-pass",
        outputDirectory
      });
      const result = await adapter.generate(request, task, (status) => progress.push(status));

      expect(result.providerTaskId).toBe("provider-task-1");
      expect(result.outputUrl).toBe("https://media.test/result.mp4");
      expect(result.outputPath).toBe(path.join(outputDirectory, "local-task-1-seedance2.mp4"));
      expect([...await readFile(result.outputPath!)]).toEqual([0, 1, 2, 3]);
      expect(progress).toEqual(["uploading", "queued", "downloading"]);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  it("rejects video-reference submissions before spending points", async () => {
    const adapter = new SeedanceAdapter({
      baseUrl: "https://example.test",
      username: "demo-user",
      password: "demo-pass",
      outputDirectory: os.tmpdir()
    });
    await expect(adapter.generate({ ...request, mode: "video", sourceVideoPath: "/tmp/source.mp4" }, task, () => undefined))
      .rejects.toThrow("暂不提交视频参考");
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
