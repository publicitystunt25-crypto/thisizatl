import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { cloudinaryConfig, clipFrameUrl } from "@/lib/cloudinary";
import { cropToFocus } from "@/lib/crop";
import { escapeXml, wrapText, fitsWithinLines } from "@/lib/textOverlay";

// Same look as the feed posts (photo on top, headline and logo in a black
// panel), built from one still frame of the clip. It's used as the Reel's
// cover image; the video itself plays unframed. Instagram crops the cover
// differently for the profile grid and the Reels tab, so the 1080x1350 post
// sits in the middle of a 1080x1920 canvas to keep everything inside the
// areas that always show.
const WIDTH = 1080;
const POST_HEIGHT = 1350;
const CANVAS_HEIGHT = 1920;
const PHOTO_HEIGHT = 880;
const BRAND_ORANGE = "#ff5a1f";

// Extracting a frame is a Cloudinary call; re-fetching it on every headline
// tweak in the review page is wasted work, so keep a few recent ones.
const frameCache = new Map<string, Buffer>();

async function getFrame(publicId: string): Promise<Buffer | null> {
  const cached = frameCache.get(publicId);
  if (cached) return cached;
  const config = cloudinaryConfig();
  if (!config) return null;
  const res = await fetch(clipFrameUrl(config, publicId));
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (frameCache.size >= 8) frameCache.delete(frameCache.keys().next().value as string);
  frameCache.set(publicId, buf);
  return buf;
}

const CAPTION_TIERS = [
  { fontSize: 115, lineHeight: 126, maxCharsPerLine: 14, maxLines: 2, logoSize: 150 },
  { fontSize: 75, lineHeight: 90, maxCharsPerLine: 22, maxLines: 3, logoSize: 130 },
  { fontSize: 60, lineHeight: 73, maxCharsPerLine: 28, maxLines: 4, logoSize: 110 },
  { fontSize: 50, lineHeight: 61, maxCharsPerLine: 35, maxLines: 5, logoSize: 95 },
];

export async function renderClipCover(publicId: string, headline: string): Promise<Buffer | null> {
  const frame = await getFrame(publicId);
  if (!frame) return null;

  const [logoBuffer, wordmarkBuffer] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "public/logo.png")),
    fs.readFile(path.join(process.cwd(), "public/wordmark.png")),
  ]);

  const photo = await cropToFocus(frame, WIDTH, PHOTO_HEIGHT, null);

  const tier =
    CAPTION_TIERS.find((t) => fitsWithinLines(headline, t.maxCharsPerLine, t.maxLines)) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1];
  const lines = wrapText(headline, tier.maxCharsPerLine, tier.maxLines);

  const logo = await sharp(logoBuffer).resize(tier.logoSize, tier.logoSize).toBuffer();
  const wordmarkWidth = 220;
  const wordmark = await sharp(wordmarkBuffer).resize({ width: wordmarkWidth }).toBuffer();

  const captionToLogoGap = 8;
  const topGap = 12;
  const bottomMargin = 18;
  const blockHeight = lines.length * tier.lineHeight;
  const groupHeight = blockHeight + captionToLogoGap + tier.logoSize;
  const availableHeight = POST_HEIGHT - bottomMargin - (PHOTO_HEIGHT + 30);
  const groupTop = PHOTO_HEIGHT + 30 + topGap + Math.max(0, (availableHeight - topGap - groupHeight) / 2);
  const captionStartY = groupTop + tier.fontSize * 0.8;
  const logoTop = groupTop + blockHeight + captionToLogoGap;

  const text = lines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${captionStartY + i * tier.lineHeight}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${tier.fontSize}" fill="${BRAND_ORANGE}">${escapeXml(line)}</text>`
    )
    .join("");
  const overlay = `<svg width="${WIDTH}" height="${POST_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <line x1="40" y1="${PHOTO_HEIGHT + 30}" x2="${WIDTH - 40}" y2="${PHOTO_HEIGHT + 30}" stroke="${BRAND_ORANGE}" stroke-width="4" stroke-dasharray="14 10" />
    ${text}
  </svg>`;

  const post = await sharp(photo)
    .extend({ bottom: POST_HEIGHT - PHOTO_HEIGHT, background: "#0a0a0a" })
    .composite([
      { input: wordmark, top: 30, left: WIDTH - 40 - wordmarkWidth },
      { input: logo, top: Math.round(logoTop), left: Math.round(WIDTH / 2 - tier.logoSize / 2) },
      { input: Buffer.from(overlay), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  const margin = (CANVAS_HEIGHT - POST_HEIGHT) / 2;
  return sharp(post)
    .extend({ top: margin, bottom: margin, background: "#0a0a0a" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export function coverResponse(buf: Buffer): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
