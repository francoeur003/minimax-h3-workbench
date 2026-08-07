# MiniMax H3 视频生成工作台 PRD

> 版本：v0.1（需求定义稿）
> 日期：2026-08-07
> 状态：待产品评审
> 产品形态：本地桌面工作台（Windows 优先），支持本地 GPU、SSH 远程 GPU、MiniMax 云 API

---

## 0. 用户意图还原

这不是一个单纯调用 MiniMax H3 的视频生成页面，而是一套交付给普通用户后可以直接使用的 **H3 整合工作台**。

产品必须替用户完成原本需要技术人员处理的环节：

```text
检查电脑能不能跑
→ 推荐本地、远程显卡或云 API
→ 一键下载正确的整合包文件
→ 自动放进正确的 ComfyUI 目录
→ 检查并修复配置
→ 用固定样片验证真的能跑
→ 在统一创作界面生成并比较 4 个结果
```

产品成功的核心标准不是“接口已经接通”，而是：**没有 Python、CUDA、SSH 和 ComfyUI 经验的用户，在正常情况下不打开终端、不手动移动模型文件，也能完成首次视频生成。**

产品设计原则：

- 面向普通用户显示“检测、下载、修复、生成”，不直接暴露节点名和环境命令；
- 高级技术信息放在详情和日志中，不阻断新手主流程；
- 每次检测都必须给明确结论和下一步按钮；
- 能自动完成的配置不要求用户复制命令；
- 本地配置不够时，直接引导连接 SSH 远程显卡或云 API；
- 工作台内的指南应跟随当前错误和当前步骤出现，而不是让用户自行翻文档。

---

## 1. 产品摘要

MiniMax H3 视频生成工作台是一套面向普通创作者和 AI 视频从业者的一站式安装、配置、生成与结果管理工具。

用户无需手动研究显卡配置、模型文件目录、ComfyUI 工作流和远程服务器连接，只需完成检测、下载和连接，即可在同一界面中使用：

1. 文生视频；
2. 首帧、尾帧或首尾帧控制视频；
3. 图生视频；
4. 视频生视频/参考视频生成；
5. 本地 GPU、SSH 远程 GPU、MiniMax 云 API 三种执行方式；
6. 一次生成并对比 4 个视频结果。

### 1.1 产品核心价值

- 把“检测硬件 → 下载模型 → 配置 ComfyUI → 连接算力 → 生成视频”压缩成一个工作台。
- 自动判断本机适合本地运行、实验性运行，还是应改用 SSH/云 API。
- 避免用户下载约 465GB 的全量模型仓，只下载当前模式真正需要的约 42.5GB 或 63.5GB 量化组合。
- 将复杂的 ComfyUI 节点图封装为普通用户可理解的表单，同时保留高级参数入口。

---

## 2. 已核实的产品事实与边界

### 2.1 模型名称

本 PRD 所指模型为 **MiniMax H3**，云 API 模型枚举值为 `MiniMax-H3`，不是旧的 `MiniMax-Hailuo-2.3`。

MiniMax H3 于 2026-07-31 发布，是可接收文本、图片、视频、音频参考并生成原生同步立体声音视频的通用多模态模型。官方宣称最长 15 秒、最高 2K、24fps。[MiniMax H3 官方发布页](https://www.minimax.io/blog/minimax-h3)

### 2.2 本地能力不等于完整云端能力

完整 H3 系统由以下部分组成：

1. H3-Context-IR：提示理解和任务编排，托管能力；
2. H3-Base：已开放权重，本地主要生成 768P；
3. H3-Regenerate-2K：托管的 2K 再生成能力。

因此，MVP 不得把“纯本地 2K”写成已支持能力：

- 本地 ComfyUI：默认提供 H3-Base 768P 工作流；
- 2K：使用 MiniMax 云 API，或在官方开放混合链路后接入；
- 若后续出现经过验证的完整本地 2K 工作流，再通过能力清单动态开放。

来源：[MiniMax H3 官方模型仓](https://huggingface.co/MiniMaxAI/MiniMax-H3)

### 2.3 本地存在两套模型分区

- `FL2VA`：文生视频、首帧、尾帧、首尾帧、图生视频；
- `Ref2VA`：参考图片、参考视频、参考音频，视频生视频归入该模式。

两套分区是独立 checkpoint。用户只使用文生/图生时无需下载 Ref2VA；需要视频生视频时再增量下载。

### 2.4 ComfyUI 支持状态

ComfyUI 0.30.0+ 已原生支持 H3，无需安装第三方 H3 节点；官方已有 T2V、I2V、R2V 模板。[ComfyUI H3 教程](https://docs.comfy.org/tutorials/video/minimax/minimax-h3) · [H3 支持合并记录](https://github.com/Comfy-Org/ComfyUI/pull/15224) · [官方工作流模板](https://github.com/Comfy-Org/workflow_templates/tree/main/templates)

### 2.5 合规边界

MiniMax H3 权重采用 MiniMax H3 Community License，不是 Apache/MIT。工作台不得直接把权重打进安装包，而应在用户接受许可后，从官方仓库按需下载。

许可证包含地域、商业使用、品牌展示和安全义务。面向全球分发前必须完成法务审核和地域门禁；本地模型下载页需要提供许可原文、确认勾选和版本记录。[许可证原文](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)

---

## 3. 产品目标与非目标

### 3.1 产品目标

- 新用户从打开工作台到提交首个视频任务不超过 15 分钟，不含模型下载时间。
- 自动识别本地硬件和软件环境，并给出可信的运行路径建议。
- 一键把模型下载到正确的 ComfyUI 目录，支持断点续传、校验和失败恢复。
- 在不暴露 ComfyUI 节点复杂度的前提下覆盖 T2V、首尾帧、I2V、V2V。
- 本地与远程使用同一套生成界面、任务状态和结果管理逻辑。
- 任何密钥、SSH 凭据和模型下载许可信息都不进入前端源码或普通日志。

### 3.2 非目标

MVP 暂不包含：

- 模型训练、LoRA 训练和模型微调；
- 任意 ComfyUI 节点图编辑器；
- 云 GPU 购买、租赁和自动开户；
- 对外开放多租户 SaaS、会员、支付和计费系统；
- 像素级可逆视频编辑、精确时间轴剪辑；
- 未经官方或内部验证的纯本地 2K；
- 任意 SSH 终端或可执行任意 Shell 命令的控制台；
- 自动上传用户素材到第三方，除非用户明确选择云 API。

---

## 4. 目标用户

### 4.1 本地显卡用户

拥有 NVIDIA/AMD GPU，但不熟悉 Python、CUDA、模型目录和 ComfyUI，希望一键检测和安装。

### 4.2 租用云显卡用户

拥有主机地址、SSH 密钥和远程 GPU，但不希望手动做端口映射、上传工作流和下载结果。

### 4.3 只使用云 API 的用户

不具备本地 GPU，希望按量付费，快速使用 768P/2K 和更完整的 H3 能力。

### 4.4 高级创作者

需要同时生成 4 个候选版本，比较随机种子、提示词和参考素材的结果，并保留参数记录。

---

## 5. 产品形态与总体架构

### 5.1 产品形态

MVP 推荐采用本地桌面应用，而不是纯网页：

- 前端：桌面 Web UI；
- 本地服务：负责硬件检测、下载、文件读写、凭据保管、SSH 和任务编排；
- 运行后端：本地 ComfyUI、SSH 隧道后的远程 ComfyUI、MiniMax 云 API。

纯静态网页无法安全完成本机 GPU 检测、指定模型目录、SSH 密钥读取和本地文件落盘，不作为 MVP 方案。

### 5.2 三种执行后端

| 后端 | 使用场景 | 生成接口 | 素材位置 | 主要限制 |
|---|---|---|---|---|
| 本地 ComfyUI | 本机有可用 GPU | ComfyUI HTTP + WebSocket | 本地 | 主要为 768P，性能取决于硬件 |
| SSH 远程 GPU | 租用云显卡 | SSH 隧道后的 ComfyUI/SGLang API | 远程 | 需保持 SSH/服务可连接 |
| MiniMax 云 API | 无本地 GPU或需要 2K | MiniMax API v2 | 上传或公网 URL | 产生费用与并发限制 |

SSH 不是模型生成协议。SSH/SFTP 只负责远程检测、安装、下载、启停、日志和文件传输；真正生成仍通过隧道后的 ComfyUI 或推理服务 API 完成。

### 5.3 统一任务适配层

三类后端统一为相同任务协议：

```text
创建任务 → 返回 taskId → 排队/运行 → 进度更新 → 成功/失败 → 结果落盘 → 展示
```

内部适配器：

- `comfy_local`
- `comfy_ssh`
- `minimax_cloud`

前端不得直接依赖任一供应商的原始响应结构。

---

## 6. 信息架构

主导航包含：

1. **就绪中心**：用 4 张状态卡显示电脑、ComfyUI、模型和执行连接是否就绪，并提供“一键准备环境”；
2. **创作台**：视频生成和四宫格结果；
3. **环境检测**：本机/远程配置检测与实测；
4. **下载与安装**：ComfyUI、模型、工作流和下载任务；
5. **配置指南**：本地、ComfyUI、SSH、云 API、故障排查；
6. **任务中心**：历史任务、日志、失败重试、结果文件；
7. **连接设置**：本地 ComfyUI、SSH 主机、MiniMax API；
8. **系统设置**：存储路径、并发、代理、日志与隐私。

首次启动进入新手引导：

```text
选择运行方式 → 环境检测 → 下载/连接 → 运行预检 → 进入创作台
```

---

## 7. 核心功能需求

## 7.1 配置检测

### 7.1.1 检测项

本机和 SSH 远程主机均检测：

- 操作系统、架构；
- CPU 型号、核心数；
- GPU 厂商、型号、数量、单卡 VRAM、总 VRAM；
- 系统内存与可用内存；
- 磁盘空闲空间、文件系统和模型目录可写性；
- NVIDIA 驱动、CUDA，或 AMD ROCm；
- Python、PyTorch；
- ComfyUI 版本，且检查是否存在 H3 原生节点；
- ffmpeg、ffprobe；
- 本地/远程 8188 端口和 ComfyUI 健康状态；
- Hugging Face、MiniMax API 和用户代理网络可达性；
- FL2VA、Ref2VA、文本编码器、视频 VAE、音频 VAE 是否存在；
- 文件大小、哈希/ETag、目录是否正确；
- 当前工作流 JSON 是否与模型及 ComfyUI 版本匹配。

### 7.1.2 判定结果

配置检测不使用简单“能/不能”二元结论，而输出四档：

| 等级 | 文案 | 判定原则 | 推荐动作 |
|---|---|---|---|
| A | 云 API 可用 | 网络、API Key、余额/权限和存储通过 | 直接使用云生成 |
| B | 官方验证本地 | GPU 拓扑、内存、软件版本命中官方验证矩阵 | 可本地运行 |
| C | 实验性可尝试 | 使用 Comfy 量化与 offload，但不在官方保证矩阵 | 运行 5 秒预检 |
| D | 不建议本地 | 缺少 GPU/内存/磁盘/运行环境，或预检失败 | 改用 SSH/云 API |

官方目前没有给出 ComfyUI 消费级单卡最低 VRAM/RAM 保证，因此不得仅因“24GB/32GB 显存”就显示“保证可跑”。单卡消费级设备必须显示“实验性”，并通过真实预检后升级为“本机实测可用”。

### 7.1.3 真实预检

预检包含两个阶段：

1. 模型加载测试：模型、文本编码器、VAE 能被加载，无缺文件和 OOM；
2. 短视频测试：使用固定提示词生成 5 秒低风险样片，记录加载时间、峰值显存、峰值内存、单步耗时和输出是否可解码。

输出结果必须区分：

- 理论配置通过；
- 模型加载通过；
- 真实生成通过；
- 失败原因和修复按钮。

### 7.1.4 检测报告

报告支持复制和导出，内容包括：

- 检测时间、工作台版本、ComfyUI 版本；
- 硬件摘要；
- 已安装组件；
- 结论和推荐后端；
- 风险项；
- 可执行修复动作；
- 隐私脱敏后的技术日志。

不得导出 API Key、私钥、密码和完整本地用户名路径。

### 7.1.5 一键准备环境

“一键准备环境”是就绪中心的主操作，自动串联：

1. 检测本机配置；
2. 选择推荐运行方式；
3. 检测或安装 ComfyUI；
4. 根据用户要使用的模式选择基础包或完整包；
5. 下载模型与官方工作流；
6. 校验目录、版本和文件完整性；
7. 启动或连接 ComfyUI；
8. 运行 5 秒预检；
9. 成功后把状态改为“已就绪”，并进入创作台。

中途失败时停留在失败步骤，保留已完成结果，并显示“自动修复”“查看原因”“改用远程显卡”三个动作。用户不需要从头重来。

---

## 7.2 内嵌下载与安装

### 7.2.1 下载套餐

下载页默认提供按需套餐，不提供“下载全部仓库”按钮。

| 套餐 | 文件 | 预计权重体积 | 支持模式 |
|---|---|---:|---|
| 基础生成包 | FL2VA + 文本编码器 + 2 个 VAE | 约 42.5GB | T2V、首尾帧、I2V |
| 视频参考扩展包 | Ref2VA | 约 21GB | V2V、参考图/视频/音频 |
| 完整创作包 | FL2VA + Ref2VA + 文本编码器 + 2 个 VAE | 约 63.5GB | 全部本地模式 |

推荐文件：

- `models/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors`
- `models/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors`
- `models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`
- `models/vae/minimax_h3_video_vae_fp16.safetensors`
- `models/vae/minimax_h3_audio_vae_fp32.safetensors`

来源：[ComfyUI 重打包权重](https://huggingface.co/Comfy-Org/MiniMax-H3)

### 7.2.2 内置下载清单与直链

工作台内置版本化 `download-manifest`，每条记录必须同时包含官方直链、目标目录、文件大小和校验信息。MVP 默认清单：

| 用途 | 官方下载地址 | 自动落盘路径 |
|---|---|---|
| FL2VA 基础模型 | [下载](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors) | `ComfyUI/models/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors` |
| Ref2VA 视频参考模型 | [下载](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors) | `ComfyUI/models/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors` |
| H3 文本编码器 | [下载](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors) | `ComfyUI/models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` |
| Video VAE | [下载](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_video_vae_fp16.safetensors) | `ComfyUI/models/vae/minimax_h3_video_vae_fp16.safetensors` |
| Audio VAE | [下载](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors) | `ComfyUI/models/vae/minimax_h3_audio_vae_fp32.safetensors` |
| T2V 工作流 | [下载](https://github.com/Comfy-Org/workflow_templates/raw/refs/heads/main/templates/video_minimax_h3_t2v.json) | `workflows/video_minimax_h3_t2v.json` |
| I2V/首尾帧工作流 | [下载](https://github.com/Comfy-Org/workflow_templates/raw/refs/heads/main/templates/video_minimax_h3_i2v.json) | `workflows/video_minimax_h3_i2v.json` |
| R2V/V2V 工作流 | [下载](https://github.com/Comfy-Org/workflow_templates/raw/refs/heads/main/templates/video_minimax_h3_r2v.json) | `workflows/video_minimax_h3_r2v.json` |

用户只点击“下载并安装”，工作台负责选择直链、创建目录、断点续传、校验和落盘；普通模式不要求用户复制下载地址或自行选择模型文件夹。

清单从工作台签名配置读取，但更新时必须保持来源允许名单和版本回滚能力，不能通过远程配置下发任意下载地址。

### 7.2.3 下载交互

每个文件显示：

- 文件名、用途、版本、体积；
- 官方来源链接；
- 安装目录；
- 未下载/下载中/暂停/校验中/已安装/损坏；
- 下载速度、已下载、剩余时间；
- 暂停、继续、取消、重试、重新校验。

用户点击“下载并安装”后：

1. 展示许可证与适用地区提示；
2. 用户勾选确认；
3. 检查磁盘空间和目录权限；
4. 只下载选中套餐；
5. 保存为 `.part` 临时文件；
6. 支持 HTTP Range 断点续传；
7. 完成后校验大小与哈希/ETag；
8. 原子移动到 ComfyUI 正确目录；
9. 刷新模型清单并运行加载检测。

### 7.2.4 本地与远程下载

- 本地模式：文件直接下载到本地 ComfyUI 模型目录；
- SSH 模式：优先让远程主机直接下载，避免先下载到本地再上传；
- 远程无法访问源时：允许本地下载后通过 SFTP 断点上传；
- 支持用户配置 HTTP/HTTPS 代理；
- 下载源使用允许名单，不允许前端传任意 Shell 下载命令。

### 7.2.5 ComfyUI 安装与更新

下载页同时支持：

- 检测已有 ComfyUI；
- 安装官方 ComfyUI；
- 更新到支持 H3 的版本；
- 下载官方工作流模板；
- 更新前创建版本和配置快照；
- 更新失败时回滚；
- 不覆盖用户已有 custom nodes、模型和 outputs。

---

## 7.3 配置指南

配置指南不是单篇说明，而是可搜索、可按当前检测结果动态跳转的内嵌知识库。

### 7.3.1 指南目录

1. MiniMax H3 能力和本地/云端区别；
2. Windows + NVIDIA 本地安装；
3. Linux 本地安装；
4. ComfyUI 0.30.0+ 安装与更新；
5. H3 模型目录说明；
6. T2V、I2V、首尾帧、Ref2VA 工作流说明；
7. 下载代理、断点续传和手动导入；
8. SSH 租用显卡配置；
9. MiniMax 云 API Key 和余额配置；
10. 提示词编写与 `<Picture 1>`、`<Video 1>`、`<Audio 1>` 标签；
11. 速度、显存和内存优化；
12. 常见故障排查；
13. 数据、隐私、版权和许可说明；
14. 版本升级和回滚。

### 7.3.2 故障排查条目

至少覆盖：

- 找不到 H3 节点；
- 模型文件放错目录；
- Video VAE 与 Audio VAE 选反；
- CUDA/PyTorch 版本不兼容；
- 显存不足或系统内存不足；
- 生成卡住、进度不更新；
- 视频黑屏、无音频、音画不同步；
- Hugging Face 无法访问；
- SSH 认证失败、host key 变化、隧道中断；
- ComfyUI 端口暴露到公网；
- 云 API 限流、余额不足、内容审核失败；
- 下载 URL 过期但任务已成功。

### 7.3.3 上下文帮助

所有报错卡片都提供“查看解决办法”，并直接跳转到对应指南章节，而不是只显示原始异常堆栈。

---

## 7.4 视频生成创作台

### 7.4.1 页面布局

桌面端采用左侧输入区、右侧结果区：

```text
┌──────────────────────┬────────────────────────────────────┐
│ 左侧输入与参数       │ 结果 1              结果 2         │
│                      │                                    │
│ 模式/素材/提示词     ├────────────────────────────────────┤
│ 参数/后端/费用/生成  │ 结果 3              结果 4         │
└──────────────────────┴────────────────────────────────────┘
```

- 左侧宽度建议 360–420px，可折叠；
- 右侧默认 2×2 四宫格；
- 小屏幕切换为单列结果卡，不隐藏功能；
- 四张卡可以处于不同状态。

### 7.4.2 左侧输入区

顶部模式严格按照用户任务切换：

1. 文生视频；
2. 图生视频；
3. 视频生视频。

“首尾帧控制”作为文生视频内的可选控制区出现，不额外制造第四个模式。上传首帧或尾帧后，工作台在后台选择 FL2VA 工作流。

公共字段：

- 提示词输入框；
- 负面要求/禁止项；
- 时长：4–15 秒；
- 画幅：21:9、16:9、4:3、1:1、3:4、9:16；
- 分辨率：按执行后端动态显示 768P/2K；
- 随机种子：随机或固定；
- 生成数量：默认 4；
- 音频：生成/静音；
- 执行后端；
- 高级参数折叠区；
- 预计耗时、预计磁盘占用、预计费用；
- “生成 4 个版本”主按钮。

### 7.4.3 文生视频模式（支持首尾帧控制）

输入：

- 文本提示词；
- 可选首帧；
- 可选尾帧；
- 只填首帧、只填尾帧、首尾都填均允许。

交互规则：

- 未上传图片时为 T2V；
- 上传端点图后自动切换到 FL2VA；
- 首尾帧与 Reference 模式互斥；
- 展示图片尺寸、比例和裁切预览；
- 不符合比例时允许适配、留边或裁切，默认不静默裁切。

### 7.4.4 图生视频模式

MVP 默认使用一张主体/场景图作为起始条件；高级模式可切换到 Ref2VA 多参考：

- 参考图片最多 9 张；
- 可为每张图设置用途：主体、产品、场景、风格；
- 提示词中自动插入 `<Picture 1>` 等标签；
- 支持拖拽排序，标签随顺序更新；
- 删除素材前提示标签引用会变化。

### 7.4.5 视频生视频模式

V2V 实际使用 Ref2VA 参考视频能力：

- 参考视频最多 3 个；
- 单段 2–15 秒，总参考时长不超过 15 秒；
- 单文件不超过 50MB；
- 可选同时参考原视频音频；
- 可补充最多 9 张图片和 3 段独立音频，但混合素材总数不超过 12；
- 工作台自动插入 `<Video 1>`、`<Audio 1>` 标签；
- 提供目的快捷项：动作参考、镜头参考、风格参考、人物/产品一致性、声音参考。

界面必须提示：V2V 是基于参考的重新生成，不是像素级编辑，不能保证逐帧复刻和精确时间对齐。

### 7.4.6 四宫格结果区

MiniMax 云 API 一次请求只返回一个任务，四宫格应创建 4 个独立子任务，而不是假设接口支持 `n=4`。

每张结果卡包含：

- 任务序号和随机种子；
- 排队、上传、运行、解码、下载、完成、失败状态；
- 进度百分比或阶段进度；
- 视频预览和音量控制；
- 耗时、分辨率、时长、文件大小；
- 下载、在文件夹中显示、复制参数；
- 固定、标记喜欢、删除；
- 仅重跑该卡；
- 查看完整任务日志。

并发策略：

- 本地/SSH 默认并发 1，四个任务顺序排队，避免 OOM；
- 用户通过预检后可提高并发；
- MiniMax 免费账户并发按官方限制采用 2+2 排队；
- 付费账户按实时配额控制；
- 断线重连只能恢复任务查询，不能重复提交已存在任务。

### 7.4.7 成本提示

选择 MiniMax 云 API 时，主按钮上方必须显示预估费用。

按 2026-08-07 官方价格：

- 768P 输出：约 $0.08/秒；
- 2K 输出：约 $0.13/秒；
- 参考视频输入也可能按秒计费；
- 四个 5 秒结果仅输出费约为：768P $1.60，2K $2.60。

实际提交前重新向后端获取或读取最新价目配置，金额超过用户设置阈值时二次确认。价格不得硬编码在前端。[MiniMax 按量计费说明](https://platform.minimax.io/docs/guides/pricing-paygo)

---

## 7.5 MiniMax 云 API 接入

### 7.5.1 接口流程

当前 H3 云 API 采用异步任务：

1. `POST https://api.minimax.io/v2/video_generation` 创建任务；
2. 获得 `task_id`；
3. `GET /v2/query/video_generation/{task_id}` 查询；
4. 状态为 `succeeded` 后读取 `task.content.url`；
5. 工作台立即下载并保存结果。

状态统一映射：

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

官方查询记录只覆盖有限时间窗口，结果 URL 也不应被当成永久存储，因此工作台必须在任务成功后立即落盘，并保存本地任务元数据。[API 指南](https://platform.minimax.io/docs/guides/video-generation) · [创建任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-create) · [查询任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)

### 7.5.2 云 API 安全

- API Key 仅保存在系统 Keychain/凭据库；
- 所有请求由本地服务发起，前端页面不读取明文 Key；
- 日志只记录 requestId/taskId，不记录 Authorization；
- 上传云端前明确提示素材将发送给 MiniMax；
- 用户可设置“仅本地处理”，启用后隐藏云端后端；
- 对重复点击使用幂等键和本地任务锁。

---

## 7.6 SSH 远程 GPU 接入

### 7.6.1 连接配置

字段包括：

- 连接名称；
- 主机/IP；
- SSH 端口；
- 用户名；
- 私钥或密码，默认推荐私钥；
- 远程 ComfyUI 目录；
- 远程模型目录；
- 远程输出目录；
- ComfyUI 端口，默认 8188；
- Python/启动脚本；
- 可选远程下载代理。

### 7.6.2 连接测试

按顺序执行：

1. TCP 可达；
2. SSH 认证；
3. host key 校验；
4. 远程 OS、GPU、内存、磁盘检测；
5. ComfyUI 版本和 H3 节点检测；
6. 模型文件检测；
7. 本地端口转发；
8. `/system_stats` 健康检查；
9. 可选 5 秒生成预检。

每一步给出独立成功/失败信息。

### 7.6.3 安全要求

- 远程 ComfyUI 只绑定 `127.0.0.1`；
- 使用 SSH `-L` 本地端口转发，不要求用户把 8188 暴露公网；
- 首次连接展示 host fingerprint，变化时阻止自动连接；
- 私钥和密码不进入项目文件、前端、日志和导出报告；
- 远程命令使用白名单模板，不接受网页传入任意命令；
- 所有文件操作限定在配置的远程根目录；
- SFTP 下载/上传支持断点续传和哈希校验；
- SSH 中断后自动重连任务查询，但不重复提交生成任务。

### 7.6.4 ComfyUI 接口

远程与本地均使用 ComfyUI 核心接口：

- `/system_stats`
- `POST /prompt`
- `/ws`
- `/history/{prompt_id}`
- `/queue`
- `/interrupt`

来源：[ComfyUI 服务通信接口](https://docs.comfy.org/development/comfyui-server/comms_routes)

---

## 7.7 任务中心

任务中心保存：

- 父任务和 4 个子任务关系；
- 模式、提示词、素材引用、参数、种子；
- 执行后端和连接名称；
- ComfyUI `prompt_id` 或 MiniMax `task_id`；
- 创建、开始、结束时间；
- 状态、进度、错误码、可重试性；
- 输出文件路径、缩略图、媒体信息；
- 费用预估和实际用量；
- 脱敏日志。

支持按日期、模式、后端、状态筛选；支持仅重试失败子任务；默认不自动删除用户结果。

---

## 8. 关键业务流程

### 8.1 本地首次使用

```text
首次启动
→ 选择“本地 GPU”
→ 环境检测
→ 选择基础包/完整包
→ 接受许可
→ 下载并校验
→ 更新或连接 ComfyUI
→ 5 秒预检
→ 进入创作台
```

### 8.2 SSH 租用显卡

```text
新增 SSH 主机
→ 校验 host key 与认证
→ 远程配置检测
→ 远程安装/选择 ComfyUI
→ 远程按需下载模型
→ 建立 SSH 隧道
→ 5 秒预检
→ 生成并通过 SFTP/接口取回结果
```

### 8.3 云 API 生成 4 个结果

```text
配置 API Key
→ 检查权限/额度
→ 选择素材、时长、分辨率
→ 展示四任务费用预估
→ 用户确认
→ 创建 4 个子任务
→ 按账户并发排队
→ 轮询/回调更新
→ 成功后立即下载
→ 四宫格展示
```

---

## 9. 状态与错误设计

统一任务状态：

- `draft`
- `validating`
- `uploading`
- `queued`
- `running`
- `decoding`
- `downloading`
- `succeeded`
- `failed`
- `cancelled`
- `interrupted`

统一错误结构：

```json
{
  "ok": false,
  "errorCode": "H3_MODEL_OOM",
  "message": "加载模型时显存和系统内存不足",
  "requestId": "req_xxx",
  "taskId": "task_xxx",
  "retryable": true,
  "suggestedAction": "降低分辨率、关闭并发，或切换到 SSH/云 API"
}
```

P0 错误必须给出直接动作：修复、重试、切换后端、打开指南或导出报告。

---

## 10. 数据与隐私

- 默认所有提示词、素材、视频和任务数据库保存在本地；
- 用户选择云 API 后才把当前任务素材上传 MiniMax；
- SSH 素材只传到用户配置的远程目录；
- 提供历史任务和缓存清理功能，删除前展示准确范围；
- 清理模型和结果必须分开，不允许“一键清理”误删用户视频；
- 日志默认保存 7 天，可调整；
- 凭据进入系统凭据库，数据库只保存引用标识；
- 应用服务仅监听 `127.0.0.1`；
- 下载源、回调 URL、远程路径均需校验，防止 SSRF、路径穿越和命令注入。

---

## 11. 非功能要求

### 11.1 稳定性

- 下载和上传可断点续传；
- 应用重启后恢复未完成任务；
- 单个结果失败不影响另外 3 个；
- 网络中断不重复计费或重复提交；
- 所有长任务有 taskId、超时和取消机制；
- 下载、安装和更新操作有事务式状态和回滚点。

### 11.2 性能

- 首屏加载不超过 3 秒；
- 本地检测基础结果不超过 10 秒；
- 远程检测不超过 30 秒，不含首次认证；
- 任务状态更新延迟不超过 10 秒；
- 大文件下载不进入前端内存；
- 四宫格视频使用懒加载，避免同时解码导致界面卡顿。

### 11.3 可观测性

- 每次生成有 requestId/taskId；
- 记录阶段耗时、后端、失败码、重试次数；
- 记录下载源、版本、文件校验结果；
- 云 API 记录费用预估和实际计费字段；
- 日志一键脱敏导出。

### 11.4 兼容性

MVP：

- Windows 11 + NVIDIA 优先；
- Ubuntu 22.04/24.04 作为远程 GPU 主要环境；
- 本地 AMD、macOS/Apple Silicon 标记为实验性或不建议，待真实验证后开放承诺。

---

## 12. MVP 范围与优先级

### P0：首个可交付版本

- Windows 桌面工作台；
- 就绪中心和“一键准备环境”；
- 本地/SSH/云 API 三后端；
- 环境检测与四档结论；
- FL2VA、Ref2VA 按需下载；
- 内置官方下载直链、自动目录映射和完整性校验；
- ComfyUI 0.30.0+ 连接和工作流执行；
- T2V、首尾帧、I2V、V2V；
- 左输入、右四宫格；
- 四子任务队列、进度、取消、失败重试；
- 结果自动落盘和任务历史；
- 配置指南与错误跳转；
- 凭据库、SSH host key、许可证确认、成本确认。

### P1：增强版本

- Linux 本地客户端；
- 多台 SSH 主机和简单任务路由；
- 下载镜像和局域网模型缓存；
- 提示词模板、参数预设；
- 任务对比、评分、收藏和批量导出；
- callback_url 代替部分云 API 轮询；
- 高级用户自定义 ComfyUI 工作流映射。

### P2：后续探索

- 本地与云端混合 2K 再生成；
- 多 GPU 自动分区和资源调度；
- 团队工作区、权限和共享；
- 云 GPU 提供商自动部署；
- 素材库和项目管理；
- API/SDK 对外开放。

---

## 13. 验收标准

### 13.1 配置检测

- 能正确读取本机和 SSH 主机的 GPU、VRAM、RAM、磁盘、驱动、ComfyUI 与模型状态；
- 不把未验证的消费级单卡显示为“官方保证可跑”；
- 真实预检成功后显示“本机实测可用”；
- OOM、缺模型、版本过旧、磁盘不足均能准确定位并给修复动作。
- 新用户能够从“一键准备环境”完成检测、下载、安装、连接和预检，正常路径不需要打开终端。

### 13.2 下载与安装

- 基础包和完整包文件数量、目录和体积正确；
- 网络中断后可继续下载；
- 文件损坏能被检测并只重下损坏文件；
- 不下载未勾选 checkpoint；
- 本地与 SSH 远程下载均可用；
- 不覆盖用户已有输出和 custom nodes。
- 普通用户只点击下载按钮即可完成目录创建、下载、校验和安装，不需要手动复制 URL 或移动模型文件。

### 13.3 视频生成

- T2V、只首帧、只尾帧、首尾帧、I2V、V2V 均完成一次真实生成；
- 四宫格创建 4 个独立子任务；
- 本地默认顺序执行，不因四宫格触发并发 OOM；
- 单个任务失败后可单独重试；
- 输出视频可播放，时长、分辨率、帧率、音轨能被 ffprobe 验证；
- 应用重启后仍能看到任务和已保存结果。

### 13.4 SSH

- 远程 8188 不暴露公网也可通过隧道生成；
- host key 变化会阻止自动连接；
- SSH 断线重连不重复创建任务；
- 私钥和密码不出现在前端、日志、数据库明文字段和导出报告。

### 13.5 云 API

- 提交前显示 4 个子任务的费用预估；
- 并发超限时自动排队，不盲目重试；
- 成功后立即下载结果；
- API Key 不出现在浏览器 Network、错误信息和日志中；
- 计费功能有每日限额、单次阈值和熔断开关。

---

## 14. 核心指标

- 首次配置完成率；
- 从首次启动到首次成功视频的时间；
- 环境检测结论与真实预检的一致率；
- 模型下载成功率和断点恢复成功率；
- 本地、SSH、云 API 各自生成成功率；
- 四子任务全部完成率；
- 因 OOM、版本、目录错误产生的失败率；
- 失败后的自助修复率；
- 单任务平均耗时和费用；
- 7 日内重复使用率。

---

## 15. 主要风险与处理方案

| 风险 | 影响 | 处理方案 |
|---|---|---|
| 权重许可证地域和商业限制 | 无法全球直接分发 | 不内置权重；许可确认、地域门禁、法务审核 |
| ComfyUI/H3 更新速度快 | 工作流和节点不兼容 | 版本清单、能力探测、固定已验证组合、可回滚 |
| 消费级显卡缺乏官方最低配置 | 检测可能误导 | 四档结论 + 真实 5 秒预检，不做静态保证 |
| 本地纯 2K 能力不完整 | 用户预期落差 | 界面按后端显示能力，本地默认 768P |
| 模型体积大 | 下载失败、磁盘不足 | 按需套餐、预检查、断点续传、远程直下 |
| 四宫格误触发四并发 | OOM 或高额费用 | 四子任务默认排队，展示成本并设置限额 |
| SSH 端口直接暴露 | 远程服务被滥用 | 127.0.0.1 + SSH 隧道 + host key 校验 |
| 断线重试造成重复计费 | 成本事故 | 幂等键、taskId 持久化、只恢复查询 |
| 云 API 结果链接过期 | 结果丢失 | 成功后立即落盘，失败自动重取链接 |
| 用户把 V2V 理解为逐帧编辑 | 结果不符合预期 | 模式说明和示例明确“参考重生成” |

---

## 16. 待产品评审决策

1. MVP 是否只保证 Windows + NVIDIA，本地 AMD 是否直接进入实验性；
2. 首发是否同时开放 MiniMax 云 API，还是先做本地 + SSH；
3. 是否面向中国大陆单一区域分发，还是首发即做全球地域门禁；
4. 采用 Tauri 还是 Electron，后台使用 Python sidecar 还是独立服务；
5. 工作台安装 ComfyUI，还是只连接已有 ComfyUI；
6. 云 API 单次费用二次确认阈值和每日限额默认值；
7. 首发验证的 GPU/内存组合和基准样片；
8. 是否提供官方源之外的合规下载镜像。

在这些决策完成前，默认方案为：**Windows + NVIDIA 优先；本地 ComfyUI、SSH、MiniMax 云 API 同时纳入架构，但云 API 费用功能默认关闭，用户主动配置后启用；本地权重只从官方源按需下载。**

---

## 17. 主要参考资料

- [MiniMax H3 官方发布页](https://www.minimax.io/blog/minimax-h3)
- [MiniMax H3 官方模型仓](https://huggingface.co/MiniMaxAI/MiniMax-H3)
- [MiniMax H3 官方代码仓](https://github.com/MiniMax-AI/MiniMax-H3)
- [MiniMax H3 Community License](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)
- [MiniMax 视频生成 API 指南](https://platform.minimax.io/docs/guides/video-generation)
- [MiniMax H3 V2 创建任务接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)
- [MiniMax H3 V2 查询任务接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)
- [MiniMax 云 API 价格](https://platform.minimax.io/docs/guides/pricing-paygo)
- [MiniMax API 并发限制](https://platform.minimax.io/docs/guides/rate-limits)
- [ComfyUI MiniMax H3 教程](https://docs.comfy.org/tutorials/video/minimax/minimax-h3)
- [ComfyUI H3 原生支持 PR](https://github.com/Comfy-Org/ComfyUI/pull/15224)
- [ComfyUI H3 权重仓](https://huggingface.co/Comfy-Org/MiniMax-H3)
- [ComfyUI 官方工作流模板](https://github.com/Comfy-Org/workflow_templates/tree/main/templates)
- [ComfyUI 服务通信接口](https://docs.comfy.org/development/comfyui-server/comms_routes)
- [SGLang MiniMax H3 部署与基准](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3)
- [vLLM MiniMax H3 低内存部署配方](https://recipes.vllm.ai/MiniMaxAI/MiniMax-H3)
- [OpenSSH 端口转发说明](https://man.openbsd.org/ssh.1)
- [OpenSSH SFTP 说明](https://man.openbsd.org/sftp)
