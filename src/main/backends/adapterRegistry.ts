import type { AppSettings, BackendKind, GenerationAdapter } from "../../shared/types";
import { SettingsStore } from "../modules/settingsStore";
import { ComfyAdapter } from "./comfyAdapter";
import { MiniMaxAdapter } from "./minimaxAdapter";
import { SeedanceAdapter } from "./seedanceAdapter";
import { SshComfyAdapter } from "./sshComfyAdapter";

export class AdapterRegistry {
  private sshAdapter?: SshComfyAdapter;
  private seedanceAdapter?: SeedanceAdapter;

  constructor(private readonly settingsStore: SettingsStore) {}

  async get(kind: BackendKind): Promise<GenerationAdapter> {
    const settings = await this.settingsStore.get();
    if (kind === "local") {
      return new ComfyAdapter({ baseUrl: settings.localComfyUrl, outputDirectory: settings.outputDirectory });
    }
    if (kind === "minimax") {
      return new MiniMaxAdapter({
        baseUrl: settings.minimaxBaseUrl,
        apiKey: await this.settingsStore.getSecret("minimaxApiKey"),
        outputDirectory: settings.outputDirectory
      });
    }
    if (kind === "seedance") {
      if (!this.seedanceAdapter) {
        this.seedanceAdapter = new SeedanceAdapter({
          baseUrl: settings.seedanceBaseUrl,
          username: await this.settingsStore.getSecret("seedanceUsername"),
          password: await this.settingsStore.getSecret("seedancePassword"),
          outputDirectory: settings.outputDirectory
        });
      }
      return this.seedanceAdapter;
    }
    if (!this.sshAdapter) {
      this.sshAdapter = new SshComfyAdapter(settings, await this.settingsStore.getSecret("sshPassword"));
    }
    return this.sshAdapter;
  }

  invalidate(settings?: AppSettings): void {
    void settings;
    this.sshAdapter?.close();
    this.sshAdapter = undefined;
    this.seedanceAdapter = undefined;
  }

  close(): void {
    this.invalidate();
  }
}
