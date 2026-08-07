import type { GenerationRequest } from "../../shared/types";

export type ComfyPrompt = Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } }>;

export interface UploadedMedia {
  name: string;
  subfolder?: string;
  type?: string;
}

const models = {
  fl2va: "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
  ref2va: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  clip: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
  videoVae: "minimax_h3_video_vae_fp16.safetensors",
  audioVae: "minimax_h3_audio_vae_fp32.safetensors"
};

export function frameLength(duration: number): number {
  const raw = Math.max(5, Math.round(duration * 24));
  return raw + ((5 - (raw % 17)) % 17);
}

function commonSampling(modelNode: string, conditioningNode: string, latentNode: string, seed: number): ComfyPrompt {
  return {
    noise: { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    sampler: { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } },
    scheduler: {
      class_type: "BasicScheduler",
      inputs: { model: [modelNode, 0], scheduler: "simple", steps: 20, denoise: 1 }
    },
    guider: {
      class_type: "BasicGuider",
      inputs: { model: [modelNode, 0], conditioning: [conditioningNode, 0] }
    },
    sample: {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["noise", 0],
        guider: ["guider", 0],
        sampler: ["sampler", 0],
        sigmas: ["scheduler", 0],
        latent_image: [latentNode, 1]
      }
    },
    decodeVideo: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["videoVae", 0] } },
    decodeAudio: { class_type: "VAEDecodeAudio", inputs: { samples: ["sample", 0], vae: ["audioVae", 0] } },
    createVideo: {
      class_type: "CreateVideo",
      inputs: { images: ["decodeVideo", 0], audio: ["decodeAudio", 0], fps: 24, bit_depth: 8 }
    },
    save: {
      class_type: "SaveVideo",
      inputs: {
        video: ["createVideo", 0],
        filename_prefix: "MiniMax-H3/H3",
        format: "auto",
        codec: { codec: "auto" }
      }
    }
  };
}

function mediaName(media: UploadedMedia): string {
  return media.subfolder ? `${media.subfolder}/${media.name}` : media.name;
}

export function buildFl2vaWorkflow(
  request: GenerationRequest,
  seed: number,
  media: { first?: UploadedMedia; last?: UploadedMedia; sourceImage?: UploadedMedia }
): ComfyPrompt {
  const prompt: ComfyPrompt = {
    model: { class_type: "UNETLoader", inputs: { unet_name: models.fl2va, weight_dtype: "default" } },
    clip: { class_type: "CLIPLoader", inputs: { clip_name: models.clip, type: "minimax", device: "default" } },
    videoVae: { class_type: "VAELoader", inputs: { vae_name: models.videoVae } },
    audioVae: { class_type: "VAELoader", inputs: { vae_name: models.audioVae } }
  };

  const first = media.sourceImage ?? media.first;
  if (first) prompt.firstImage = { class_type: "LoadImage", inputs: { image: mediaName(first) } };
  if (media.last) prompt.lastImage = { class_type: "LoadImage", inputs: { image: mediaName(media.last) } };

  const inputs: Record<string, unknown> = {
    clip: ["clip", 0],
    vae: ["videoVae", 0],
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    length: frameLength(request.duration)
  };
  if (first) inputs.first_frame = ["firstImage", 0];
  if (media.last) inputs.last_frame = ["lastImage", 0];
  prompt.conditioning = { class_type: "MiniMaxH3ImageToVideo", inputs };
  return { ...prompt, ...commonSampling("model", "conditioning", "conditioning", seed) };
}

export function buildRef2vaWorkflow(request: GenerationRequest, seed: number, media: { sourceVideo: UploadedMedia }): ComfyPrompt {
  const promptText = request.prompt.includes("<Video 1>")
    ? request.prompt
    : `Use <Video 1> as the motion and camera reference. ${request.prompt}`;
  const prompt: ComfyPrompt = {
    model: { class_type: "UNETLoader", inputs: { unet_name: models.ref2va, weight_dtype: "default" } },
    clip: { class_type: "CLIPLoader", inputs: { clip_name: models.clip, type: "minimax", device: "default" } },
    videoVae: { class_type: "VAELoader", inputs: { vae_name: models.videoVae } },
    audioVae: { class_type: "VAELoader", inputs: { vae_name: models.audioVae } },
    loadVideo: { class_type: "LoadVideo", inputs: { file: mediaName(media.sourceVideo) } },
    videoParts: { class_type: "GetVideoComponents", inputs: { video: ["loadVideo", 0] } },
    conditioning: {
      class_type: "MiniMaxH3ReferenceToVideo",
      inputs: {
        clip: ["clip", 0],
        vae: ["videoVae", 0],
        audio_vae: ["audioVae", 0],
        "ref_videos.ref_video_0": ["videoParts", 0],
        "ref_video_audios.ref_video_audio_0": ["videoParts", 1],
        prompt: promptText,
        width: request.width,
        height: request.height,
        length: frameLength(request.duration),
        ref_image_size: "match"
      }
    }
  };
  return { ...prompt, ...commonSampling("model", "conditioning", "conditioning", seed) };
}
