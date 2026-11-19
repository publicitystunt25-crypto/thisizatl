import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { cropToFocus, fitWholePhoto } from "@/lib/crop";
import { escapeXml, wrapText, fitsWithinLines } from "@/lib/textOverlay";
import { BRAND_ORANGE, WORDMARK_WIDTH } from "@/lib/coverLayout";

// First slide of a video carousel: 1080x1350 (4:5), the shape Instagram uses
// for the whole carousel, so the clips that follow are cropped to match it.
// With a photo, the picture fills the slide and fades dark toward the bottom
// where the headline sits; without one, it's a dark brand card.
export const CAROUSEL_WIDTH = 1080;
export const CAROUSEL_HEIGHT = 1350;

const TIERS = [
  { fontSize: 112, lineHeight: 124, maxCharsPerLine: 15, maxLines: 3 },
  { fontSize: 86, lineHeight: 98, maxCharsPerLine: 18, maxLines: 4 },
  { fontSize: 70, lineHeight: 82, maxCharsPerLine: 22, maxLines: 4 },
  { fontSize: 60, lineHeight: 72, maxCharsPerLine: 28, maxLines: 5 },
];

// fromVideo: the picture is a still from a clip. A widescreen still is shown
// whole over a blurred copy of itself instead of being cropped to a sliver.
export async function renderCarouselCover(
  photo: Buffer | null,
  headline: string,
  opts: { fromVideo?: boolean } = {}
): Promise<Buffer> {
  const W = CAROUSEL_WIDTH;
  const H = CAROUSEL_HEIGHT;

  const [logoBuffer, wordmarkBuffer] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "public/logo.png")),
    fs.readFile(path.join(process.cwd(), "public/wordmark.png")),
  ]);

  let landscape = false;
  if (photo && opts.fromVideo) {
    const meta = await sharp(photo).metadata();
    landscape = (meta.width ?? 1) > (meta.height ?? 1);
  }
  const base = photo
    ? landscape
      ? await fitWholePhoto(photo, W, H)
      : await cropToFocus(photo, W, H, null)
    : await sharp({ create: { width: W, height: H, channels: 3, background: "#0a0a0a" } })
        .jpeg()
        .toBuffer();

  const tier = TIERS.find((t) => fitsWithinLines(headline, t.maxCharsPerLine, t.maxLines)) ?? TIERS[TIERS.length - 1];
  const lines = wrapText(headline, tier.maxCharsPerLine, tier.maxLines);
  const blockHeight = lines.length * tier.lineHeight;
  // With a photo the headline sits low, under a fade. On the plain card it
  // is centered on the slide instead.
  const textBottom = photo ? 1210 : Math.round(H / 2 + blockHeight / 2 + 20);
  const firstBaseline = textBottom - blockHeight + tier.fontSize * 0.8;
  const fadeStart = Math.max(300, textBottom - blockHeight - 420);

  const text = lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${firstBaseline + i * tier.lineHeight}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${tier.fontSize}" fill="${BRAND_ORANGE}">${escapeXml(line)}</text>`
    )
    .join("");

  const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="${fadeStart}" x2="0" y2="${textBottom - blockHeight - 40}">
        <stop offset="0" stop-color="#0a0a0a" stop-opacity="0" />
        <stop offset="1" stop-color="#0a0a0a" stop-opacity="0.82" />
      </linearGradient>
    </defs>
    ${photo ? `<rect x="0" y="${fadeStart}" width="${W}" height="${textBottom - blockHeight - 40 - fadeStart}" fill="url(#fade)" />
    <rect x="0" y="${textBottom - blockHeight - 40}" width="${W}" height="${H - (textBottom - blockHeight - 40)}" fill="#0a0a0a" fill-opacity="0.82" />` : ""}
    ${text}
    <text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" fill-opacity="0.85">SWIPE</text>
  </svg>`;

  const logo = await sharp(logoBuffer).resize(200, 200).toBuffer();
  const wordmark = await sharp(wordmarkBuffer).resize({ width: WORDMARK_WIDTH }).toBuffer();

  return sharp(base)
    .composite([
      { input: Buffer.from(overlay), top: 0, left: 0 },
      { input: logo, top: 60, left: 50 },
      { input: wordmark, top: 80, left: W - 50 - WORDMARK_WIDTH },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}
