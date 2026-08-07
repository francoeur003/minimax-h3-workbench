# Security

- MiniMax API Key 与 SSH 密码通过 Electron `safeStorage` 加密后保存在本机用户数据目录。
- 渲染进程启用 `contextIsolation`，关闭 `nodeIntegration`。
- ComfyUI 建议仅监听 `127.0.0.1`；远程访问通过 SSH 隧道完成。
- 模型下载仅允许内置官方来源，禁止界面下发任意下载命令。
- 请勿在 Issue、日志或截图中提交 API Key、私钥、密码和远程主机凭据。

安全问题请通过 GitHub 仓库的 Security Advisory 私下报告。
