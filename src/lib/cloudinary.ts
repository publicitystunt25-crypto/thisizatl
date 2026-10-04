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

// ---------------------------------------------------------------------------
// Overlay rendering (headline + wordmark burned into a clip)
// ---------------------------------------------------------------------------

// The wordmark lives in Cloudinary as thisizatl/brand/wordmark; inside a
// transformation URL a folder slash becomes a colon.
const WORDMARK_LAYER = "thisizatl:brand:wordmark";
const OUTPUT_FORMAT = "f_mp4,vc_h264,ac_aac,q_auto:good";

// Cloudinary text layers need commas and slashes double-encoded on top of
// normal URL encoding, or the layer silently truncates at the first one.
function encodeOverlayText(text: string): string {
  return encodeURIComponent(text).replace(/%2C/g, "%252C").replace(/%2F/g, "%252F");
}

// 1080x1920 (Reels size), laid out like the feed posts: the clip on top
// (1080x1300) and a black panel under it holding the headline in orange with
// the ThisIzATL wordmark below. Vertical clips are cropped to fill the video
// area; landscape clips are padded instead so they aren't chopped up. (Cloudinary
// only accepts a plain color background for video, not blurred or auto ones.)
export function overlayTransformation(headline: string, landscape: boolean): string {
  const parts = [
    landscape ? "c_pad,w_1080,h_1300,b_rgb:0a0a0a" : "c_fill,w_1080,h_1300,g_auto",
    "c_pad,w_1080,h_1920,g_north,b_rgb:0a0a0a",
  ];
  const text = headline.replace(/s+/g, " ").trim().slice(0, 140);
  if (text) {
    parts.push(
      `l_text:Arial_84_bold_text_align_center:${encodeOverlayText(text)},co_rgb:ff5a1f,c_fit,w_960,g_north,y_1340`
    );
  }
  parts.push(`l_${WORDMARK_LAYER},w_560,g_south,y_90`);
  return parts.join("/");
}

// Whether the uploaded clip is wider than tall. Looked up from Cloudinary
// (conditional "if_ar" chains in the URL don't work reliably for video).
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

export function overlayVideoUrl(config: CloudinaryConfig, publicId: string, headline: string, landscape: boolean): string {
  return `https://res.cloudinary.com/${config.cloudName}/video/upload/${overlayTransformation(headline, landscape)}/${OUTPUT_FORMAT}/${publicId}.mp4`;
}

// A single frame of the finished overlay, for a quick poster image.
export function overlayPosterUrl(config: CloudinaryConfig, publicId: string, headline: string, landscape: boolean): string {
  return `https://res.cloudinary.com/${config.cloudName}/video/upload/so_1/${overlayTransformation(headline, landscape)}/${publicId}.jpg`;
}

function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

// Renders the overlay version now (instead of lazily on first view) so the
// file is guaranteed to exist before Instagram is asked to fetch it. Returns
// false if Cloudinary is still working when waitMs runs out -- it keeps
// going on its side, so a second call shortly after finishes quickly.
export async function renderOverlayVideo(
  config: CloudinaryConfig,
  publicId: string,
  headline: string,
  waitMs: number,
  landscape: boolean
): Promise<boolean> {
  const startedAt = Date.now();
  const eager = `${overlayTransformation(headline, landscape)}/${OUTPUT_FORMAT}`;
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
      throw new Error(data?.error?.message || `Cloudinary overlay render failed (${res.status})`);
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return false;
    throw err;
  }

  // A 200 from the render call doesn't prove the video exists: a transformation
  // Cloudinary can't actually build still comes back OK here, and the failure
  // only shows up when something fetches the video (Instagram, as an opaque
  // "media upload failed"). Fetch it ourselves and surface Cloudinary's real
  // reason.
  const url = overlayVideoUrl(config, publicId, headline, landscape);
  do {
    const head = await fetch(url, { method: "HEAD" });
    const type = head.headers.get("content-type") ?? "";
    if (head.ok && type.startsWith("video/")) return true;
    if (head.status === 400 || head.status === 401 || head.status === 403) {
      throw new Error(
        `Cloudinary couldn't build the overlay video: ${head.headers.get("x-cld-error") || head.status}`
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  } while (Date.now() - startedAt < waitMs);
  return false;
}

// Removes the original and every rendered version once a clip is finished
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
