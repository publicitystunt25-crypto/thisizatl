import { createHash } from "crypto";
import { CLIP_FOLDER } from "@/app/clip/limits";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

// Cloudinary's signed-upload scheme: SHA-1 of the signed params (sorted by
// name, joined as k=v with &) with the API secret appended. The browser must
// then send exactly these params, so it can only upload into the folder this
// signature was issued for, and only within the signature's short lifetime.
export function createUploadSignature(config: CloudinaryConfig): {
  timestamp: number;
  folder: string;
  signature: string;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${CLIP_FOLDER}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + config.apiSecret).digest("hex");
  return { timestamp, folder: CLIP_FOLDER, signature };
}

export interface UploadedVideo {
  secure_url: string;
  duration: number | null;
  bytes: number;
}

// Asks Cloudinary directly whether this public_id really exists as a video,
// instead of trusting the URL/size/duration the browser reports -- anyone can
// call the submit action with made-up values.
export async function fetchUploadedVideo(
  config: CloudinaryConfig,
  publicId: string
): Promise<UploadedVideo | null> {
  const path = publicId.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/video/upload/${path}`,
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64"),
      },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    secure_url?: string;
    duration?: number;
    bytes?: number;
  };
  if (!data.secure_url) return null;
  return { secure_url: data.secure_url, duration: data.duration ?? null, bytes: data.bytes ?? 0 };
}

// One still frame from a clip (1 second in), used to build the Reel cover.
export function clipFrameUrl(config: CloudinaryConfig, publicId: string): string {
  return `https://res.cloudinary.com/${config.cloudName}/video/upload/so_1,w_1080,c_limit/${publicId}.jpg`;
}

// Removes the uploaded clip once it is finished
// with (posted or declined) so storage doesn't pile up.
export async function deleteClipAssets(config: CloudinaryConfig, publicId: string): Promise<void> {
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/video/upload?public_ids[]=${encodeURIComponent(publicId)}&invalidate=true`,
    {
      method: "DELETE",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64"),
      },
    }
  );
  if (!res.ok) console.error("Cloudinary delete failed:", res.status, await res.text());
}
