import { describe, expect, it } from "vitest";
import type { GenerationRequest } from "../../shared/types";
import { buildFl2vaWorkflow, buildRef2vaWorkflow, frameLength } from "./workflows";

const request: GenerationRequest = {
  mode: "text", backend: "local", prompt: "A cinematic tracking shot", duration: 6,
  ratio: "16:9", resolution: "768P", width: 1280, height: 720, count: 4, baseSeed: 42
};

describe("MiniMax H3 ComfyUI workflow", () => {
  it("uses a frame length accepted by the model", () => {
    expect(frameLength(4) % 17).toBe(5);
    expect(frameLength(15) % 17).toBe(5);
  });

  it("wires first and last frames into FL2VA", () => {
    const workflow = buildFl2vaWorkflow(request, 43, {
      first: { name: "first.png" }, last: { name: "last.png", subfolder: "frames" }
    });
    expect(workflow.conditioning.class_type).toBe("MiniMaxH3ImageToVideo");
    expect(workflow.conditioning.inputs.first_frame).toEqual(["firstImage", 0]);
    expect(workflow.conditioning.inputs.last_frame).toEqual(["lastImage", 0]);
    expect(workflow.noise.inputs.noise_seed).toBe(43);
  });

  it("adds the reference token for video-to-video", () => {
    const workflow = buildRef2vaWorkflow({ ...request, mode: "video" }, 44, { sourceVideo: { name: "source.mp4" } });
    expect(workflow.conditioning.class_type).toBe("MiniMaxH3ReferenceToVideo");
    expect(String(workflow.conditioning.inputs.prompt)).toContain("<Video 1>");
    expect(workflow.loadVideo.inputs.file).toBe("source.mp4");
  });
});
