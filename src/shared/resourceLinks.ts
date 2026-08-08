import type { ResourceLink } from "./types";

export const RESOURCE_LINKS: ResourceLink[] = [
  {
    id: "h3-fl2va-int8",
    label: "H3 FL2VA 生成模型（INT8）",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors?download=true",
    description: "用于文生视频、图生视频和首尾帧工作流。",
    action: "download",
    sizeBytes: 20_970_379_616,
    targetDirectory: "ComfyUI/models/diffusion_models/"
  },
  {
    id: "h3-ref2va-int8",
    label: "H3 Ref2VA 生成模型（INT8）",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors?download=true",
    description: "用于视频、图片或音频参考的复杂生成工作流。",
    action: "download",
    sizeBytes: 20_970_379_616,
    targetDirectory: "ComfyUI/models/diffusion_models/"
  },
  {
    id: "h3-text-encoder",
    label: "Qwen3-VL 32B 文本编码器",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors?download=true",
    description: "MiniMax H3 官方 NVFP4/AWQ 文本编码器。",
    action: "download",
    sizeBytes: 15_687_142_551,
    targetDirectory: "ComfyUI/models/text_encoders/"
  },
  {
    id: "h3-video-vae",
    label: "MiniMax H3 视频 VAE",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_video_vae_fp16.safetensors?download=true",
    description: "官方 FP16 视频编码与解码模型。",
    action: "download",
    sizeBytes: 5_207_808_496,
    targetDirectory: "ComfyUI/models/vae/"
  },
  {
    id: "h3-audio-vae",
    label: "MiniMax H3 音频 VAE",
    category: "model",
    url: "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors?download=true",
    description: "官方 FP32 原生音频编码与解码模型。",
    action: "download",
    sizeBytes: 605_254_808,
    targetDirectory: "ComfyUI/models/vae/"
  },
  {
    id: "comfyui",
    label: "ComfyUI",
    category: "comfyui",
    url: "https://github.com/comfyanonymous/ComfyUI",
    description: "从 ComfyUI 官方 GitHub 获取程序与安装说明。",
    action: "open"
  },
  {
    id: "workflow",
    label: "H3 官方工作流",
    category: "workflow",
    url: "https://github.com/Comfy-Org/workflow_templates/tree/main/templates",
    description: "打开官方工作流模板仓库，自行选择 T2V、I2V 或 R2V 工作流。",
    action: "open"
  },
  {
    id: "api-docs",
    label: "MiniMax H3 API 文档",
    category: "docs",
    url: "https://platform.minimax.io/docs/api-reference/video-generation-v2-create",
    description: "查看云端视频生成接口、参数、计费与限制。",
    action: "open"
  }
];
