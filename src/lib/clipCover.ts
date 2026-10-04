import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { cloudinaryConfig, clipFrameUrl } from "@/lib/cloudinary";
import { cropToFocus } from "@/lib/crop";
import { escapeXml, wrapText, fitsWithinLines } from "@/lib/textOverlay";

// Full-bleed 1080x1920 cover built from one still frame of the clip: the
// picture fills the whole canvas and fades to black toward the bottom, where
// the headline and logo sit. It's used as the Reel's cover image; the video
// itself plays unframed. Instagram's profile grid shows only the middle
// 3:4 of the cover (roughly y 240-1680), so the text and wordmark are kept
// inside that band.
const WIDTH = 1080;
const HEIGHT = 1920;
const TEXT_BOTTOM = 1650;
// Landscape clips end here, with the headline block starting just below.
const FRONT_BOTTOM = 1000;
// How dark the fade gets: enough for the orange text to stay readable, but
// not so solid that the picture disappears at the bottom.
const FADE_OPACITY = 0.82;
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

// The logo is twice the size it was on the feed-style layout; the headline
// is a step larger, which is why fewer characters fit on a line.
const CAPTION_TIERS = [
  { fontSize: 128, lineHeight: 140, maxCharsPerLine: 13, maxLines: 2, logoSize: 300 },
  { fontSize: 84, lineHeight: 100, maxCharsPerLine: 20, maxLines: 3, logoSize: 270 },
  { fontSize: 68, lineHeight: 82, maxCharsPerLine: 25, maxLines: 4, logoSize: 230 },
  { fontSize: 56, lineHeight: 68, maxCharsPerLine: 31, maxLines: 5, logoSize: 200 },
];

export type FrameStyle = "none" | "solid" | "dashed" | "double" | "polaroid";

// Decorative border drawn over the whole cover, in the brand orange.
function frameSvg(style: FrameStyle): string | null {
  const o = BRAND_ORANGE;
  const open = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  switch (style) {
    case "solid":
      return `${open}
        <rect x="28" y="28" width="${WIDTH - 56}" height="${HEIGHT - 56}" rx="30" fill="none" stroke="${o}" stroke-width="12" />
        <rect x="56" y="56" width="${WIDTH - 112}" height="${HEIGHT - 112}" rx="16" fill="none" stroke="${o}" stroke-width="3" stroke-opacity="0.75" />
      </svg>`;
    case "dashed":
      return `${open}
        <rect x="36" y="36" width="${WIDTH - 72}" height="${HEIGHT - 72}" rx="22" fill="none" stroke="${o}" stroke-width="7" stroke-dasharray="30 18" />
      </svg>`;
    case "double":
      return `${open}
        <rect x="26" y="26" width="${WIDTH - 52}" height="${HEIGHT - 52}" fill="none" stroke="${o}" stroke-width="9" />
        <rect x="54" y="54" width="${WIDTH - 108}" height="${HEIGHT - 108}" fill="none" stroke="${o}" stroke-width="3" />
        <rect x="14" y="14" width="40" height="40" fill="${o}" />
        <rect x="${WIDTH - 54}" y="14" width="40" height="40" fill="${o}" />
        <rect x="14" y="${HEIGHT - 54}" width="40" height="40" fill="${o}" />
        <rect x="${WIDTH - 54}" y="${HEIGHT - 54}" width="40" height="40" fill="${o}" />
      </svg>`;
    case "polaroid":
      return `${open}
        <path fill="#f5efe6" fill-rule="evenodd" d="M0 0H${WIDTH}V${HEIGHT}H0Z M40 40V${HEIGHT - 40}H${WIDTH - 40}V40Z" />
        <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" fill="none" stroke="${o}" stroke-width="6" />
      </svg>`;
    default:
      return null;
  }
}

// The style the live covers use.
const COVER_FRAME: FrameStyle = "solid";

export async function renderClipCover(
  publicId: string,
  headline: string,
  opts: { style?: FrameStyle; frame?: Buffer } = {}
): Promise<Buffer | null> {
  const frame = opts.frame ?? (await getFrame(publicId));
  if (!frame) return null;

  const [logoBuffer, wordmarkBuffer] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "public/logo.png")),
    fs.readFile(path.join(process.cwd(), "public/wordmark.png")),
  ]);

  // Vertical clips fill the canvas. A landscape clip would have to be
  // zoomed in about 3x to do that, so it goes in at full width over a
  // darkened, blurred copy of itself instead.
  const meta = await sharp(frame).metadata();
  const landscape = (meta.width ?? 1) > (meta.height ?? 1);
  let base: Buffer;
  if (!landscape) {
    base = await cropToFocus(frame, WIDTH, HEIGHT, null);
  } else {
    const backdrop = await sharp(frame)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .blur(40)
      .modulate({ brightness: 0.45 })
      .toBuffer();
    const front = await sharp(frame).resize({ width: WIDTH }).toBuffer();
    const frontH = (await sharp(front).metadata()).height ?? 608;
    base = await sharp(backdrop)
      .composite([{ input: front, top: Math.round(Math.max(0, FRONT_BOTTOM - frontH)), left: 0 }])
      .toBuffer();
  }

  const tier =
    CAPTION_TIERS.find((t) => fitsWithinLines(headline, t.maxCharsPerLine, t.maxLines)) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1];
  const lines = wrapText(headline, tier.maxCharsPerLine, tier.maxLines);

  const logo = await sharp(logoBuffer).resize(tier.logoSize, tier.logoSize).toBuffer();
  const wordmarkWidth = 240;
  const frameLayer = frameSvg(opts.style ?? COVER_FRAME);
  const wordmark = await sharp(wordmarkBuffer).resize({ width: wordmarkWidth }).toBuffer();

  const captionToLogoGap = 8;
  const blockHeight = lines.length * tier.lineHeight;
  const groupTop = TEXT_BOTTOM - (blockHeight + captionToLogoGap + tier.logoSize);
  const captionStartY = groupTop + tier.fontSize * 0.8;
  const logoTop = groupTop + blockHeight + captionToLogoGap;
  // The fade starts well above the first line so it blends in smoothly.
  const fadeStart = Math.max(500, groupTop - 520);
  const fadeSolid = Math.max(fadeStart + 100, groupTop - 20);

  const text = lines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${captionStartY + i * tier.lineHeight}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${tier.fontSize}" fill="${BRAND_ORANGE}">${escapeXml(line)}</text>`
    )
    .join("");
  const overlay = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="${fadeStart}" x2="0" y2="${fadeSolid}">
        <stop offset="0" stop-color="#0a0a0a" stop-opacity="0" />
        <stop offset="1" stop-color="#0a0a0a" stop-opacity="${FADE_OPACITY}" />
      </linearGradient>
    </defs>
    <rect x="0" y="${fadeStart}" width="${WIDTH}" height="${fadeSolid - fadeStart}" fill="url(#fade)" />
    <rect x="0" y="${fadeSolid}" width="${WIDTH}" height="${HEIGHT - fadeSolid}" fill="#0a0a0a" fill-opacity="${FADE_OPACITY}" />
    ${text}
  </svg>`;

  return sharp(base)
    .composite([
      { input: Buffer.from(overlay), top: 0, left: 0 },
      { input: logo, top: Math.round(logoTop), left: Math.round(WIDTH / 2 - tier.logoSize / 2) },
      { input: wordmark, top: 280, left: WIDTH - 90 - wordmarkWidth },
      ...(frameLayer ? [{ input: Buffer.from(frameLayer), top: 0, left: 0 }] : []),
    ])
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
