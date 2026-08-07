# Architecture

```text
Renderer (React)
  → Preload IPC interface
    → Electron Main
      → SystemInspector
      → DownloadManager
      → TaskOrchestrator
        → ComfyAdapter
        → SshComfyAdapter
        → MiniMaxAdapter
```

`GenerationAdapter` 是生成模块的外部接口。三个适配器共享同一种请求、进度和结果类型，界面无需理解 ComfyUI prompt、SSH 隧道或 MiniMax V2 响应结构。

本地和远程 ComfyUI 使用同一个 `ComfyAdapter`。远程适配器只负责先建立本地端口转发，再把本地隧道地址交给 `ComfyAdapter`。

下载模块通过版本化 manifest 将“官方 URL → ComfyUI 目标目录”固化，避免用户手动移动模型。
