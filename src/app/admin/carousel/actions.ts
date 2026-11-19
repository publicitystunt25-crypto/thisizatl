"use server";

import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import {
  cloudinaryConfig,
  createUploadSignature,
  deleteClipAssets,
  deleteImageAsset,
  fetchUploadedVideo,
  uploadImageBuffer,
} from "@/lib/cloudinary";
import { getSetting, setSetting } from "@/lib/db";
import { renderCarouselCover } from "@/lib/carouselCover";
import { postVideoCarousel, MAX_CAROUSEL_SLIDES } from "@/lib/videoCarousel";
import { extractInstagramHandle, normalizeInstagramInput } from "@/lib/social";
import { MAX_HEADLINE_LENGTH } from "@/lib/coverLayout";

const STATUS_KEY = "video_carousel_status";
// Longest clip allowed as a carousel slide. Kept conservative on purpose.
const MAX_SLIDE_SECONDS = 60;

export type CarouselStatus = {
  state: "idle" | "posting" | "done" | "failed";
  message: string;
  startedAt?: number;
  mediaId?: string;
};

async function writeStatus(status: CarouselStatus): Promise<void> {
  await setSetting(STATUS_KEY, JSON.stringify(status));
}

export async function getCarouselStatusAction(): Promise<CarouselStatus> {
  await requireAdmin();
  const raw = await getSetting(STATUS_KEY);
  if (!raw) return { state: "idle", message: "" };
  try {
    return JSON.parse(raw) as CarouselStatus;
  } catch {
    return { state: "idle", message: "" };
  }
}

export type TicketResult =
  | { ok: true; cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }
  | { ok: false; error: string };

// Same signed browser-to-Cloudinary upload the public clip page uses, so the
// video files never pass through this server's limited memory.
export async function getCarouselUploadTicket(): Promise<TicketResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Cloudinary isn't configured." };
  const { timestamp, folder, signature } = createUploadSignature(config);
  return { ok: true, cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature };
}

async function readCoverPhoto(formData: FormData): Promise<Buffer | null> {
  const file = formData.get("coverPhoto");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("The cover photo isn't an image.");
  if (file.size > 25 * 1024 * 1024) throw new Error("The cover photo is over 25MB.");
  // rotate() applies the photo's EXIF orientation so phone photos aren't sideways.
  return sharp(Buffer.from(await file.arrayBuffer())).rotate().jpeg({ quality: 92 }).toBuffer();
}

function cleanHeadline(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_HEADLINE_LENGTH);
}

export type PreviewResult = { ok: true; dataUrl: string } | { ok: false; error: string };

export async function previewCarouselCoverAction(formData: FormData): Promise<PreviewResult> {
  await requireAdmin();
  try {
    const headline = cleanHeadline(String(formData.get("headline") || ""));
    if (!headline) return { ok: false, error: "Add a headline for the cover first." };
    const photo = await readCoverPhoto(formData);
    const cover = await renderCarouselCover(photo, headline);
    return { ok: true, dataUrl: `data:image/jpeg;base64,${cover.toString("base64")}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't build the cover." };
  }
}

export type PostResult = { ok: true } | { ok: false; error: string };

// Validates everything, then starts posting in the background and returns at
// once: Instagram takes minutes to process this many videos, far longer than a
// web request may run, so the page polls getCarouselStatusAction.
export async function postCarouselAction(formData: FormData): Promise<PostResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Cloudinary isn't configured." };

  const current = await getCarouselStatusAction();
  if (current.state === "posting" && Date.now() - (current.startedAt ?? 0) < 45 * 60 * 1000) {
    return { ok: false, error: "A carousel is already posting. Wait for it to finish." };
  }

  const headline = cleanHeadline(String(formData.get("headline") || ""));
  if (!headline) return { ok: false, error: "Add a headline for the cover first." };
  const caption = String(formData.get("caption") || "").trim().slice(0, 2200);
  if (!caption) return { ok: false, error: "Add a caption first." };

  const publicIds = formData.getAll("clip").map((v) => String(v)).filter(Boolean);
  if (publicIds.length < 1) return { ok: false, error: "Upload at least one clip." };
  if (publicIds.length + 1 > MAX_CAROUSEL_SLIDES) {
    return { ok: false, error: `Instagram allows ${MAX_CAROUSEL_SLIDES} slides, so at most ${MAX_CAROUSEL_SLIDES - 1} clips plus the cover.` };
  }

  const collaborators: string[] = [];
  for (const raw of formData.getAll("collab").map((v) => String(v))) {
    if (!raw.trim()) continue;
    const url = normalizeInstagramInput(raw);
    const handle = url ? extractInstagramHandle(url) : null;
    if (!handle) return { ok: false, error: `"${raw.trim()}" doesn't look like an Instagram handle.` };
    if (!collaborators.includes(handle)) collaborators.push(handle);
  }
  if (collaborators.length > 3) return { ok: false, error: "Instagram allows up to 3 collaborators on one post." };

  // Ask Cloudinary about each clip instead of trusting what the browser sent.
  const videoUrls: string[] = [];
  for (let i = 0; i < publicIds.length; i++) {
    const clip = await fetchUploadedVideo(config, publicIds[i]);
    if (!clip) return { ok: false, error: `Clip ${i + 1} isn't on Cloudinary. Upload it again.` };
    if (clip.duration != null && clip.duration > MAX_SLIDE_SECONDS + 0.5) {
      return { ok: false, error: `Clip ${i + 1} is ${Math.round(clip.duration)} seconds. Keep carousel clips to ${MAX_SLIDE_SECONDS} seconds or less.` };
    }
    videoUrls.push(clip.secure_url);
  }

  let photo: Buffer | null;
  try {
    photo = await readCoverPhoto(formData);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read the cover photo." };
  }

  await writeStatus({ state: "posting", message: "Starting", startedAt: Date.now() });
  void runCarouselPost({ headline, caption, collaborators, publicIds, videoUrls, photo });
  return { ok: true };
}

async function runCarouselPost(job: {
  headline: string;
  caption: string;
  collaborators: string[];
  publicIds: string[];
  videoUrls: string[];
  photo: Buffer | null;
}): Promise<void> {
  const config = cloudinaryConfig();
  const startedAt = Date.now();
  let coverPublicId: string | null = null;
  const progress = (message: string) => void writeStatus({ state: "posting", message, startedAt }).catch(() => {});
  try {
    if (!config) throw new Error("Cloudinary isn't configured.");
    progress("Building the cover slide");
    const cover = await renderCarouselCover(job.photo, job.headline);
    const uploaded = await uploadImageBuffer(config, cover, "thisizatl/carousel-covers");
    coverPublicId = uploaded.publicId;

    const mediaId = await postVideoCarousel({
      coverUrl: uploaded.url,
      videoUrls: job.videoUrls,
      caption: job.caption,
      collaborators: job.collaborators,
      onProgress: progress,
    });
    await writeStatus({ state: "done", message: "Posted to Instagram", startedAt, mediaId });

    // Instagram has its own copies now; free the Cloudinary storage.
    for (const id of job.publicIds) {
      await deleteClipAssets(config, id).catch((err) => console.error("Couldn't delete carousel clip:", err));
    }
    if (coverPublicId) await deleteImageAsset(config, coverPublicId).catch(() => {});
  } catch (err) {
    console.error("Video carousel post failed:", err);
    await writeStatus({
      state: "failed",
      message: err instanceof Error ? err.message : String(err),
      startedAt,
    });
  }
}
