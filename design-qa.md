# MiniMax H3 工作台 v0.1.2 视觉验收

- source visual truth path: `design-audit/minimax-reference-20260807/official-brand-assets.png`
- implementation screenshot path: `workbench-preview.png`
- combined comparison evidence: `design-audit/minimax-reference-20260807/comparison-v0.1.2.png`
- viewport: Electron content area约 `1440 × 874` CSS px；macOS Retina `deviceScaleFactor: 2`
- source pixels: `1000 × 1600`
- implementation pixels: `2880 × 1748`
- normalization: 两侧均按比例缩放并置于 `1000 × 1000`、`#F7F8FA` 背景画布，组合图为 `2000 × 1000`
- state: 就绪检测首页，尚未运行硬件检测

## Full-view comparison evidence

组合图左侧为 MiniMax 官方网站当前品牌卡片素材，右侧为 v0.1.2 Electron 实际渲染。实现已复用官方视觉的粉红至橙色渐变、近白背景、深色标题、浅灰辅助文字、紫蓝辅助色和大圆角卡片体系，同时保留桌面工作台原有信息架构。

## Required fidelity surfaces

- Fonts and typography: 使用 Inter / SF Pro Display / PingFang SC 回退组合；中文标题采用高字重、紧字距，正文和小标签层级清晰。官方素材中的圆润无衬线气质已在系统字体约束下合理复现。
- Spacing and layout rhythm: 侧边栏、主内容、卡片栅格和操作按钮保持稳定间距；1440 宽度下无裁切、重叠或隐藏控制。
- Colors and visual tokens: 主渐变为 `#FF276F → #FF7038`，背景 `#F7F8FA`，主文字 `#181E25`，辅助文字 `#86909C`；紫色 `#7A27FF` 和蓝色 `#1BA4FF` 仅作次级区分。
- Image quality and asset fidelity: 本工作台首页不依赖装饰图片；MiniMax 官方素材仅作为视觉真值，不打包进应用。实际截图清晰，无压缩伪影或透明边缘问题。
- Copy and content: 保留就绪检测、生成工作台、下载链接、配置指南和连接设置等原功能文案；版本号已更新为 `0.1.2`。

## Focused region comparison

本轮目标是整体品牌色系替换，而不是复刻 MiniMax 某一业务页面。组合图中标题、主按钮、导航高亮、指标卡片和辅助色均可清楚阅读，因此无需额外局部裁切。

## Comparison history

1. v0.1.1：发现 P1 品牌偏差——深黑背景与荧光绿主色不符合 MiniMax 当前粉橙渐变和浅色产品视觉。
2. v0.1.2：替换全局视觉令牌、按钮、导航、卡片、表单、状态和窗口底色；移除导航中的符号型图标，保留英文功能标签。
3. 修复后证据：`comparison-v0.1.2.png`。未发现仍需处理的 P0、P1 或 P2 视觉问题。

## Verification

- TypeScript typecheck: passed
- Vitest: 2 files / 6 tests passed
- Vite production build: passed
- Electron production renderer launch and screenshot: passed
- Console-blocking render error: none observed

## Follow-up polish

- P3：后续若获得 MiniMax H3 官方桌面产品的完整界面截图，可继续微调字体光学字重与表单控件细节；不影响本次品牌色系验收。

final result: passed
