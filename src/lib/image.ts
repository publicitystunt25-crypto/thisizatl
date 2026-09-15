import sharp from "sharp";
import heicConvert from "heic-convert";
import { detectFocusWithVision, type VisionFocus } from "./visionFocus";

// iPhones default their camera to HEIC, and mobile submitters overwhelmingly
// upload straight from their camera roll -- but the prebuilt sharp/libvips
// binary this runs on can't decode real HEIC (Nokia's HEVC codec license
// blocks it from shipping in prebuilt binaries; sharp can only *write*
// HEIF/AVIF, not read HEIC). Every mobile submission with an unconverted
// iPhone photo was hitting an uncaught "Unsupported feature" error out of
// sharp() below. Detect it from the file's own magic bytes (rather than
// trusting the browser-reported mime type) and pre-convert to JPEG with the
// pure-JS heic-convert package, which doesn't depend on the system's libvips
// build at all.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return buffer.toString("ascii", 4, 8) === "ftyp" && HEIC_BRANDS.has(buffer.toString("ascii", 8, 12));
}

// Phone/camera uploads can come in at 4000px+ wide and several MB -- the site
// never displays them larger than ~1600px, so storing (and re-serving) the
// original just makes every page load fetch multi-megabyte blobs from the
// database for no visual benefit. Downscale and recompress at upload time.
export async function processImageUpload(
  buffer: Buffer,
  maxWidth: number
): Promise<{ buffer: Buffer; mime: string; width: number; height: number; focus: VisionFocus | null }> {
  const sourceBuffer = isHeic(buffer)
    ? Buffer.from(await heicConvert({ buffer, format: "JPEG", quality: 0.92 }))
    : buffer;

  const resized = sharp(sourceBuffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true });
  const out = await resized.toBuffer({ resolveWithObject: true });

  const focus = await detectFocusWithVision(out.data, out.info.width, out.info.height);

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
