import type { DownloadItem } from "./types";

const modelBase = "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main";
const workflowBase = "https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates";

export const DOWNLOAD_MANIFEST: DownloadItem[] = [
  {
    id: "fl2va",
    label: "FL2VA 基础生成模型",
    package: "base",
    url: `${modelBase}/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors`,
    relativePath: "models/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors",
    expectedBytes: 21_000_000_000
  },
  {
    id: "ref2va",
    label: "Ref2VA 视频参考模型",
    package: "reference",
    url: `${modelBase}/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors`,
    relativePath: "models/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors",
    expectedBytes: 21_000_000_000
  },
  {
    id: "text-encoder",
    label: "Qwen3-VL H3 文本编码器",
    package: "base",
    url: `${modelBase}/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`,
    relativePath: "models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
    expectedBytes: 15_700_000_000
  },
  {
    id: "video-vae",
    label: "H3 Video VAE",
    package: "base",
    url: `${modelBase}/vae/minimax_h3_video_vae_fp16.safetensors`,
    relativePath: "models/vae/minimax_h3_video_vae_fp16.safetensors",
    expectedBytes: 5_210_000_000
  },
  {
    id: "audio-vae",
    label: "H3 Audio VAE",
    package: "base",
    url: `${modelBase}/vae/minimax_h3_audio_vae_fp32.safetensors`,
    relativePath: "models/vae/minimax_h3_audio_vae_fp32.safetensors",
    expectedBytes: 605_000_000
  },
  {
    id: "workflow-t2v",
    label: "官方 T2V 工作流",
    package: "workflow",
    url: `${workflowBase}/video_minimax_h3_t2v.json`,
    relativePath: "user/workflows/video_minimax_h3_t2v.json"
  },
  {
    id: "workflow-i2v",
    label: "官方 I2V/首尾帧工作流",
    package: "workflow",
    url: `${workflowBase}/video_minimax_h3_i2v.json`,
    relativePath: "user/workflows/video_minimax_h3_i2v.json"
  },
  {
    id: "workflow-r2v",
    label: "官方 R2V/V2V 工作流",
    package: "workflow",
    url: `${workflowBase}/video_minimax_h3_r2v.json`,
    relativePath: "user/workflows/video_minimax_h3_r2v.json"
  }
];
