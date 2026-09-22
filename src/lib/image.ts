import sharp from "sharp";
import { detectFocusWithVision, type VisionFocus } from "./visionFocus";

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
  const resized = sharp(buffer)
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
