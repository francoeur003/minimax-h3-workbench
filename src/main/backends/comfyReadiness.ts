import { H3_MODELS } from "./workflows";

type JsonObject = Record<string, unknown>;

export const H3_MODEL_REQUIREMENTS = [
  { key: "fl2va", name: H3_MODELS.fl2va, loader: "UNETLoader", input: "unet_name", directory: "ComfyUI/models/diffusion_models/" },
  { key: "ref2va", name: H3_MODELS.ref2va, loader: "UNETLoader", input: "unet_name", directory: "ComfyUI/models/diffusion_models/" },
  { key: "clip", name: H3_MODELS.clip, loader: "CLIPLoader", input: "clip_name", directory: "ComfyUI/models/text_encoders/" },
  { key: "videoVae", name: H3_MODELS.videoVae, loader: "VAELoader", input: "vae_name", directory: "ComfyUI/models/vae/" },
  { key: "audioVae", name: H3_MODELS.audioVae, loader: "VAELoader", input: "vae_name", directory: "ComfyUI/models/vae/" }
] as const;

export function inspectH3Readiness(nodes: JsonObject): {
  hasH3Nodes: boolean;
  missingModels: Array<(typeof H3_MODEL_REQUIREMENTS)[number]>;
} {
  const hasH3Nodes = "MiniMaxH3ImageToVideo" in nodes && "MiniMaxH3ReferenceToVideo" in nodes;
  const missingModels = hasH3Nodes ? H3_MODEL_REQUIREMENTS.filter((requirement) => {
    const choices = inputChoices(nodes, requirement.loader, requirement.input);
    return !choices.some((choice) => choice === requirement.name || choice.endsWith(`/${requirement.name}`) || choice.endsWith(`\\${requirement.name}`));
  }) : [...H3_MODEL_REQUIREMENTS];
  return { hasH3Nodes, missingModels };
}

function inputChoices(nodes: JsonObject, className: string, inputName: string): string[] {
  const node = objectValue(nodes[className]);
  const input = objectValue(node?.input);
  const required = objectValue(input?.required);
  const definition = required?.[inputName];
  if (!Array.isArray(definition)) return [];
  const choices = definition[0];
  return Array.isArray(choices) ? choices.filter((value): value is string => typeof value === "string") : [];
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
