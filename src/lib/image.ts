import sharp from "sharp";
import { detectFocusWithVision, type VisionFocus } from "./visionFocus";

// This server runs with 512MB of RAM total (a real, confirmed ceiling --
// several photo uploads in a row have OOM-killed the entire process, taking
// the whole site down for every visitor, not just the upload). sharp/libvips
// caches decoded operations by default to speed up repeated processing of
// the same image, which is never useful here (every upload is processed
// exactly once) and just holds extra decoded bitmap data in memory.
// Disabling it, and capping libvips to one concurrent operation, keeps
// memory use to roughly one photo at a time instead of compounding across
// concurrent requests.
sharp.cache(false);
sharp.concurrency(1);

// Phone/camera uploads can come in at 4000px+ wide and several MB -- the site
// never displays them larger than ~1600px, so storing (and re-serving) the
// original just makes every page load fetch multi-megabyte blobs from the
// database for no visual benefit. Downscale and recompress at upload time.
export async function processImageUpload(
  buffer: Buffer,
  maxWidth: number,
  // Focus detection is a Claude vision call -- several seconds each -- and
  // only matters for the one photo actually used as a post's main/featured
  // image (that's the only place focus_x/focus_y gets read). Skipping it for
  // gallery photos isn't just wasted cost: uploading several photos at once
  // previously ran this call once per photo in sequence, which is what made
  // a multi-photo upload look "stuck" for many seconds longer than it needed to.
  computeFocus = true
): Promise<{ buffer: Buffer; mime: string; width: number; height: number; focus: VisionFocus | null }> {
  // sharp's default pixel-count safety limit (~268 million pixels, meant to
  // guard against decompression-bomb-style attacks) is smaller than what a
  // modern phone's 48MP+ camera or a panorama shot can produce -- a real
  // submitted photo threw "Input image exceeds pixel limit" here well before
  // it ever got resized down to a reasonable size. We resize every upload
  // immediately below, so there's no benefit to keeping that ceiling low.
  const resized = sharp(buffer, { limitInputPixels: false })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true });
  const out = await resized.toBuffer({ resolveWithObject: true });

  const focus = computeFocus
    ? await detectFocusWithVision(out.data, out.info.width, out.info.height)
    : null;

  return {
    buffer: out.data,
    mime: "image/jpeg",
    width: out.info.width,
    height: out.info.height,
    focus,
  };
}

export interface StockPhoto {
  url: string;
  credit_name: string;
  credit_url: string;
  width: number;
  height: number;
}

// Looks up a topic-matched stock photo via Pexels (free, attribution-friendly —
// unlike scraping the source article's own photo, this carries no copyright risk).
export async function fetchStockPhoto(
  query: string
): Promise<StockPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    return {
      url: photo.src.large,
      credit_name: photo.photographer,
      credit_url: photo.photographer_url,
      width: photo.width,
      height: photo.height,
    };
  } catch {
    return null;
  }
}
