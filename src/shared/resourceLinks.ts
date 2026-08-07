import type { ResourceLink } from "./types";

export const RESOURCE_LINKS: ResourceLink[] = [
  {
    id: "model",
    label: "MiniMax H3 模型",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3_ComfyUI",
    description: "在官方 Hugging Face 仓库阅读许可证、查看文件清单并自行下载模型。"
  },
  {
    id: "comfyui",
    label: "ComfyUI",
    category: "comfyui",
    url: "https://github.com/comfyanonymous/ComfyUI",
    description: "从 ComfyUI 官方 GitHub 获取程序与安装说明。"
  },
  {
    id: "workflow",
    label: "H3 官方工作流",
    category: "workflow",
    url: "https://github.com/Comfy-Org/workflow_templates/tree/main/templates",
    description: "打开官方工作流模板仓库，自行选择 T2V、I2V 或 R2V 工作流。"
  },
  {
    id: "api-docs",
    label: "MiniMax H3 API 文档",
    category: "docs",
    url: "https://platform.minimax.io/docs/api-reference/video-generation-v2-create",
    description: "查看云端视频生成接口、参数、计费与限制。"
  }
];
