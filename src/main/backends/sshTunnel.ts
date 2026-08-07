import { readFile } from "node:fs/promises";
import net, { type Server } from "node:net";
import { Client, type ConnectConfig } from "ssh2";
import type { AppSettings } from "../../shared/types";

export class SshTunnel {
  private client?: Client;
  private server?: Server;
  private localPort?: number;
  private observedFingerprint = "";

  constructor(private readonly config: AppSettings["ssh"], private readonly password: string) {}

  async start(): Promise<{ url: string; fingerprint: string }> {
    if (this.client && this.server && this.localPort) {
      return { url: `http://127.0.0.1:${this.localPort}`, fingerprint: this.observedFingerprint };
    }
    if (!this.config.host || !this.config.username) throw new Error("请填写 SSH 主机和用户名。 ");
    this.client = new Client();
    const privateKey = this.config.privateKeyPath ? await readFile(this.config.privateKeyPath, "utf8") : undefined;
    const connectConfig: ConnectConfig = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      privateKey,
      password: privateKey ? undefined : this.password || undefined,
      readyTimeout: 15_000,
      hostHash: "sha256",
      hostVerifier: (fingerprint: string) => {
        this.observedFingerprint = fingerprint;
        return !this.config.hostFingerprint || this.config.hostFingerprint === fingerprint;
      }
    };
    await new Promise<void>((resolve, reject) => {
      this.client!.once("ready", resolve).once("error", reject).connect(connectConfig);
    });
    this.server = net.createServer((socket) => {
      this.client!.forwardOut(
        socket.remoteAddress || "127.0.0.1",
        socket.remotePort || 0,
        this.config.remoteComfyHost,
        this.config.remoteComfyPort,
        (error, stream) => {
          if (error) return socket.destroy(error);
          socket.pipe(stream).pipe(socket);
        }
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject).listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("SSH 隧道未获得本地端口。 ");
    this.localPort = address.port;
    return { url: `http://127.0.0.1:${this.localPort}`, fingerprint: this.observedFingerprint };
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.client) throw new Error("SSH 尚未连接。 ");
    return new Promise((resolve, reject) => {
      this.client!.exec(command, (error, stream) => {
        if (error) return reject(error);
        let stdout = "";
        let stderr = "";
        stream.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
        stream.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
        stream.on("close", () => resolve({ stdout, stderr }));
      });
    });
  }

  close(): void {
    this.server?.close();
    this.client?.end();
    this.server = undefined;
    this.client = undefined;
    this.localPort = undefined;
  }
}
