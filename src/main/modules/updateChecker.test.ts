import { describe, expect, it, vi } from "vitest";
import { checkForUpdates } from "./updateChecker";

describe("checkForUpdates", () => {
  it("reports a newer public GitHub release", async () => {
    const fetcher = vi.fn(async () => json({
      tag_name: "v0.1.5",
      name: "MiniMax H3 工作台 v0.1.5",
      html_url: "https://github.com/francoeur003/minimax-h3-workbench/releases/tag/v0.1.5",
      published_at: "2026-08-10T00:00:00Z"
    }));

    await expect(checkForUpdates("0.1.4", fetcher)).resolves.toEqual({
      currentVersion: "0.1.4",
      latestVersion: "0.1.5",
      updateAvailable: true,
      releaseName: "MiniMax H3 工作台 v0.1.5",
      releaseUrl: "https://github.com/francoeur003/minimax-h3-workbench/releases/tag/v0.1.5",
      publishedAt: "2026-08-10T00:00:00Z"
    });
  });

  it("reports that the installed version is current", async () => {
    const fetcher = vi.fn(async () => json({
      tag_name: "v0.1.4",
      name: "MiniMax H3 工作台 v0.1.4",
      html_url: "https://github.com/francoeur003/minimax-h3-workbench/releases/tag/v0.1.4",
      published_at: "2026-08-09T00:00:00Z"
    }));

    const result = await checkForUpdates("0.1.4", fetcher);
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBe("0.1.4");
  });

  it("returns an actionable error when GitHub cannot be reached", async () => {
    const fetcher = vi.fn(async () => new Response("rate limited", { status: 403 }));
    await expect(checkForUpdates("0.1.4", fetcher)).rejects.toThrow("更新服务器返回 HTTP 403");
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
