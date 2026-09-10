import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPostById } from "@/lib/db";
import { cropToFocus } from "@/lib/crop";

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_HEIGHT = 880;
const BRAND_ORANGE = "#ff5a1f";
const BRAND_RED = "#e8342a";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Rough word-wrap by character count -- good enough for a bold display
// headline at a known font size, no need for exact text metrics.
function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let wordIndex = 0;

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex];
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    wordIndex++;
  }

  const usedAllWords = wordIndex >= words.length;
  if (current) lines.push(current);

  if (!usedAllWords && lines.length > 0) {
    let last = lines[lines.length - 1];
    if (last.length > maxCharsPerLine - 3) {
      last = last.slice(0, maxCharsPerLine - 3).trimEnd();
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines.slice(0, maxLines);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const post = await getPostById(Number(id));
  if (!post || !post.image_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const siteUrl = process.env.SITE_URL || "https://thisizatl.com";
  const imageUrl = post.image_url.startsWith("/")
    ? `${siteUrl}${post.image_url}`
    : post.image_url;

  // Optional ?caption= override -- lets the caller supply a spotlight-style
  // line instead of the raw title.
  const { searchParams } = new URL(req.url);
  const caption = searchParams.get("caption") || post.title;

  // Optional ?cropY=<0-100> -- manual nudge for the photo crop's vertical
  // anchor when there's no detected face to go by and the top-anchored
  // default doesn't frame the shot well.
  const cropYParam = searchParams.get("cropY");
  const manualCropY = cropYParam !== null ? Number(cropYParam) : null;

  const [imgRes, logoBuffer, wordmarkBuffer] = await Promise.all([
    fetch(imageUrl),
    fs.readFile(path.join(process.cwd(), "public/logo.png")),
    fs.readFile(path.join(process.cwd(), "public/wordmark.png")),
  ]);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Source image unavailable" }, { status: 502 });
  }
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const focus =
    manualCropY != null
      ? { x: 50, y: manualCropY }
      : post.focus_x != null && post.focus_y != null
        ? { x: post.focus_x, y: post.focus_y }
        : null;
  const photo = await cropToFocus(imgBuffer, WIDTH, PHOTO_HEIGHT, focus);

  const logoSize = 190;
  const logo = await sharp(logoBuffer).resize(logoSize, logoSize).toBuffer();

  // Real wordmark asset (same file exported from the site's actual header
  // styling), not re-rendered text -- guarantees the exact font/gradient
  // instead of an approximation. Only used small in the corner; the logo
  // mark alone carries the brand in the main block below the photo.
  const wordmarkCornerWidth = 220;
  const wordmarkCorner = await sharp(wordmarkBuffer).resize({ width: wordmarkCornerWidth }).toBuffer();

  // Wider lines (more chars each) instead of many short stacked lines --
  // keeps the block shorter vertically so it can actually sit centered in
  // the available space instead of running out of room near the edge. A
  // longer title that still wraps to 3+ lines at the bigger size steps down
  // to a smaller font/line-height instead -- otherwise the block runs taller
  // than the fixed space below the photo, colliding with the divider above
  // or the canvas edge below (both happened before this existed).
  let captionLines = wrapText(caption, 21, 4);
  let captionLineHeight = 92;
  let captionFontSize = 76;
  if (captionLines.length >= 3) {
    captionLines = wrapText(caption, 34, 3);
    captionLineHeight = 62;
    captionFontSize = 50;
  }

  // Caption text first, logo mark below it -- both centered together within
  // the space below the divider.
  const captionToLogoGap = 15;
  const topGap = 30;
  const bottomMargin = 50;
  const captionBlockHeight = captionLines.length * captionLineHeight;
  const groupHeight = captionBlockHeight + captionToLogoGap + logoSize;
  const availableHeight = HEIGHT - bottomMargin - (PHOTO_HEIGHT + 30);
  const groupTop =
    PHOTO_HEIGHT + 30 + topGap + Math.max(0, (availableHeight - topGap - groupHeight) / 2);
  const captionStartY = groupTop + captionFontSize * 0.8;
  const logoTop = groupTop + captionBlockHeight + captionToLogoGap;

  const captionSvg = captionLines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${captionStartY + i * captionLineHeight}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${captionFontSize}" fill="${BRAND_ORANGE}">${escapeXml(line)}</text>`
    )
    .join("");

  const overlaySvg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <line x1="40" y1="${PHOTO_HEIGHT + 30}" x2="${WIDTH - 40}" y2="${PHOTO_HEIGHT + 30}" stroke="${BRAND_ORANGE}" stroke-width="4" stroke-dasharray="14 10" />
      ${captionSvg}
    </svg>
  `;

  const composited = await sharp(photo)
    .extend({ bottom: HEIGHT - PHOTO_HEIGHT, background: "#0a0a0a" })
    .composite([
      {
        input: wordmarkCorner,
        top: 30,
        left: WIDTH - 40 - wordmarkCornerWidth,
      },
      { input: logo, top: Math.round(logoTop), left: Math.round(WIDTH / 2 - logoSize / 2) },
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return new NextResponse(new Uint8Array(composited), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(composited.length),
      // no-store, not a longer max-age: this endpoint gets iterated on and
      // re-fetched by Meta at post time -- a cached stale response (e.g. via
      // Cloudflare in front of Render) previously caused an old layout to
      // get published even after the code was already fixed and redeployed.
      "Cache-Control": "no-store",
    },
  });
}
