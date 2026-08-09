import type { UpdateInfo } from "../../shared/types";

const LATEST_RELEASE_API = "https://api.github.com/repos/francoeur003/minimax-h3-workbench/releases/latest";
const RELEASE_PREFIX = "https://github.com/francoeur003/minimax-h3-workbench/releases/";

interface GithubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
}

export async function checkForUpdates(
  currentVersion: string,
  fetcher: typeof fetch = fetch
): Promise<UpdateInfo> {
  const response = await fetcher(LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `MiniMax-H3-Workbench/${currentVersion}`
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`更新服务器返回 HTTP ${response.status}`);

  const release = (await response.json()) as GithubRelease;
  const latestVersion = normalizeVersion(release.tag_name);
  if (!latestVersion) throw new Error("更新服务器没有返回有效版本号");
  if (!release.html_url?.startsWith(RELEASE_PREFIX)) throw new Error("更新下载地址未通过安全校验");

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: release.name || `MiniMax H3 工作台 v${latestVersion}`,
    releaseUrl: release.html_url,
    publishedAt: release.published_at
  };
}

function normalizeVersion(value?: string): string | undefined {
  const normalized = value?.trim().replace(/^v/i, "");
  return normalized && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : undefined;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split("-")[0].split(".").map(Number);
  const rightParts = right.split("-")[0].split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}
