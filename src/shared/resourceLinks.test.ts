import { describe, expect, it } from "vitest";
import { RESOURCE_LINKS } from "./resourceLinks";

describe("RESOURCE_LINKS", () => {
  it("exposes five direct official MiniMax H3 model downloads", () => {
    const models = RESOURCE_LINKS.filter((item) => item.category === "model");
    expect(models).toHaveLength(5);
    for (const model of models) {
      expect(model.action).toBe("download");
      expect(model.url).toMatch(/^https:\/\/huggingface\.co\/Comfy-Org\/MiniMax-H3\/resolve\/main\//);
      expect(model.url).toContain("download=true");
      expect(model.sizeBytes).toBeGreaterThan(500_000_000);
      expect(model.targetDirectory).toMatch(/^ComfyUI\/models\//);
    }
  });
});
