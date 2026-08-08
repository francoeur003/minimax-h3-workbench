import { app, safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings, SecretName } from "../../shared/types";

const defaultSettings = (): AppSettings => ({
  localComfyUrl: "http://127.0.0.1:8188",
  outputDirectory: path.join(app.getPath("videos"), "MiniMax-H3"),
  defaultBackend: "seedance",
  minimaxBaseUrl: "https://api.minimax.io",
  seedanceBaseUrl: "https://aiopenapi.kuaizi.cn",
  ssh: {
    name: "远程显卡",
    host: "",
    port: 22,
    username: "root",
    privateKeyPath: "",
    hostFingerprint: "",
    remoteComfyHost: "127.0.0.1",
    remoteComfyPort: 8188,
    remoteComfyPath: "~/ComfyUI"
  }
});

export class SettingsStore {
  private readonly filePath = path.join(app.getPath("userData"), "settings.json");
  private readonly secretPath = path.join(app.getPath("userData"), "secrets.json");

  async get(): Promise<AppSettings> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<AppSettings>;
      const defaults = defaultSettings();
      return { ...defaults, ...raw, ssh: { ...defaults.ssh, ...(raw.ssh ?? {}) } };
    } catch {
      return defaultSettings();
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const next = {
      ...current,
      ...patch,
      ssh: patch.ssh ? { ...current.ssh, ...patch.ssh } : current.ssh
    };
    await this.atomicWrite(this.filePath, next);
    return next;
  }

  async setSecret(name: SecretName, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，拒绝保存明文密钥。 ");
    const secrets = await this.readSecrets();
    secrets[name] = safeStorage.encryptString(value).toString("base64");
    await this.atomicWrite(this.secretPath, secrets);
  }

  async getSecret(name: SecretName): Promise<string> {
    const secrets = await this.readSecrets();
    const encrypted = secrets[name];
    if (!encrypted) return "";
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  }

  async hasSecret(name: SecretName): Promise<boolean> {
    const secrets = await this.readSecrets();
    return Boolean(secrets[name]);
  }

  private async readSecrets(): Promise<Record<string, string>> {
    try {
      return JSON.parse(await readFile(this.secretPath, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async atomicWrite(filePath: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(temporary, filePath);
  }
}
