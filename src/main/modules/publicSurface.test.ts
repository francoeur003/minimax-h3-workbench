import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public product surface", () => {
  it("does not expose the removed third-party video connector", async () => {
    const files = [
      "src/renderer/App.tsx",
      "README.md",
      "public/demo-videos/manifest.json",
      ...[1, 2, 3, 4].map((index) => `public/demo-videos/showcase-0${index}.mp4`)
    ];
    const content = (await Promise.all(files.map(async (file) => (await readFile(path.resolve(file))).toString("latin1")))).join("\n");
    expect(content).not.toMatch(/seedance|kuaizi/i);
  });
});
