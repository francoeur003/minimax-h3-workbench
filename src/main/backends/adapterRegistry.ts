import type { AppSettings, BackendKind, GenerationAdapter } from "../../shared/types";
import { SettingsStore } from "../modules/settingsStore";
import { ComfyAdapter } from "./comfyAdapter";
import { MiniMaxAdapter } from "./minimaxAdapter";
import { SshComfyAdapter } from "./sshComfyAdapter";

export class AdapterRegistry {
  private sshAdapter?: SshComfyAdapter;

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
    if (!this.sshAdapter) {
      this.sshAdapter = new SshComfyAdapter(settings, await this.settingsStore.getSecret("sshPassword"));
    }
    return this.sshAdapter;
  }

  invalidate(settings?: AppSettings): void {
    void settings;
    this.sshAdapter?.close();
    this.sshAdapter = undefined;
  }

  close(): void {
    this.invalidate();
  }
}
