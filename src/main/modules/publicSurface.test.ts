import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public product surface", () => {
  it("does not expose the removed third-party video connector", async () => {
    const files = [
      "src/renderer/App.tsx",
      "README.md",
      "public/demo-videos/manifest.json"
    ];
    const content = (await Promise.all(files.map((file) => readFile(path.resolve(file), "utf8")))).join("\n");
    expect(content).not.toMatch(/seedance|kuaizi/i);
  });
});
