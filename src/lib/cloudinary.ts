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

// ---------------------------------------------------------------------------
// Widescreen clips: fill the black bars with a blurred copy of the video
// ---------------------------------------------------------------------------

// Whether the uploaded clip is wider than it is tall, asked of Cloudinary.
export async function clipIsLandscape(config: CloudinaryConfig, publicId: string): Promise<boolean> {
  const path = publicId.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/video/upload/${path}`,
    { headers: { Authorization: "Basic " + Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64") } }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { width?: number; height?: number };
  return (data.width ?? 0) > (data.height ?? 1);
}

// 1080x1920 Reel frame: the clip blown up to fill the whole frame and blurred
// as the background, with the sharp clip full-width in the middle. Instagram
// treats black bars as a sign of a low-effort repost, so widescreen clips get
// this. (A layer's public id uses ":" where the folder path has "/".)
// Cloudinary text layers need commas and slashes double-encoded on top of
// normal URL encoding, or the layer cuts off at the first one. Emoji can't be
// drawn by the font and would blank the whole layer, so they are dropped.
function encodeOverlayText(text: string): string {
  const plain = text
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return encodeURIComponent(plain).replace(/%2C/g, "%252C").replace(/%2F/g, "%252F");
}

function blurFillTransformation(publicId: string, headline: string): string {
  const layerId = publicId.split("/").join(":");
  const parts = [
    "c_fill,w_1080,h_1920",
    "e_blur:1200",
    `l_video:${layerId}`,
    "c_fit,w_1080",
    "fl_layer_apply,g_center",
  ];
  const text = encodeOverlayText(headline);
  // The headline sits in the blurred area under the clip, high enough that
  // Instagram's caption and buttons at the very bottom don't cover it.
  if (text) {
    parts.push(
      `l_text:Arial_72_bold_text_align_center:${text},co_rgb:ff5a1f,b_rgb:0a0a0acc,c_fit,w_940,g_south,y_400`
    );
  }
  return parts.join("/");
}
const BLURFILL_FORMAT = "f_mp4,vc_h264,ac_aac,q_auto:good";

export function blurFillVideoUrl(config: CloudinaryConfig, publicId: string, headline: string): string {
  return `https://res.cloudinary.com/${config.cloudName}/video/upload/${blurFillTransformation(publicId, headline)}/${BLURFILL_FORMAT}/${publicId}.mp4`;
}

function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

// Builds the blurred-fill version now, so it exists before Instagram is asked
// to fetch it, and confirms it is really deliverable (a transformation that
// Cloudinary can't build still returns OK from the render call and only fails
// when something fetches the video). Returns false if it isn't ready when
// waitMs runs out.
export async function renderBlurFillVideo(
  config: CloudinaryConfig,
  publicId: string,
  waitMs: number,
  headline: string
): Promise<boolean> {
  const startedAt = Date.now();
  const eager = `${blurFillTransformation(publicId, headline)}/${BLURFILL_FORMAT}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { eager, public_id: publicId, timestamp, type: "upload" };
  const body = new URLSearchParams({
    ...params,
    api_key: config.apiKey,
    signature: signParams(params, config.apiSecret),
  });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/video/explicit`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(waitMs),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error?.message || `Cloudinary render failed (${res.status})`);
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return false;
    throw err;
  }

  const url = blurFillVideoUrl(config, publicId, headline);
  do {
    const head = await fetch(url, { method: "HEAD" });
    const type = head.headers.get("content-type") ?? "";
    if (head.ok && type.startsWith("video/")) return true;
    if (head.status === 400 || head.status === 401 || head.status === 403) {
      throw new Error(`Cloudinary couldn't build the widescreen version: ${head.headers.get("x-cld-error") || head.status}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  } while (Date.now() - startedAt < waitMs);
  return false;
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
