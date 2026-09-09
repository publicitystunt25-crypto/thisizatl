import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPostById } from "@/lib/db";

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_HEIGHT = 880;
const BRAND_ORANGE = "#ff5a1f";
const BRAND_RED = "#e8342a";

// Crops a source image to exactly targetW x targetH. When a detected face
// focus point is available, scales to cover the target box and extracts a
// window centered on that point (clamped so it never runs off the edge) --
// otherwise falls back to a top-anchored crop, since every photo we've
// handled this way has had its subject positioned in the upper portion, and
// "attention"-based auto-cropping has picked the wrong region on action
// shots (e.g. mid-swing poses) where the most "salient" area isn't the face.
async function cropToFocus(
  imgBuffer: Buffer,
  targetW: number,
  targetH: number,
  focus: { x: number; y: number } | null
): Promise<Buffer> {
  if (!focus) {
    return sharp(imgBuffer).resize(targetW, targetH, { fit: "cover", position: "top" }).toBuffer();
  }

  const meta = await sharp(imgBuffer).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  const scale = Math.max(targetW / srcW, targetH / srcH);
  const scaledW = Math.round(srcW * scale);
  const scaledH = Math.round(srcH * scale);

  const focusPxX = (focus.x / 100) * scaledW;
  const focusPxY = (focus.y / 100) * scaledH;

  const left = Math.min(Math.max(0, Math.round(focusPxX - targetW / 2)), scaledW - targetW);
  const top = Math.min(Math.max(0, Math.round(focusPxY - targetH / 2)), scaledH - targetH);

  return sharp(imgBuffer)
    .resize(scaledW, scaledH)
    .extract({ left, top, width: targetW, height: targetH })
    .toBuffer();
}

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
  // line ("ThisIzATL sits down with X to talk...") instead of the raw title.
  const { searchParams } = new URL(req.url);
  const caption = searchParams.get("caption") || post.title;

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
    post.focus_x != null && post.focus_y != null
      ? { x: post.focus_x, y: post.focus_y }
      : null;
  const photo = await cropToFocus(imgBuffer, WIDTH, PHOTO_HEIGHT, focus);

  const logoSize = 130;
  const logo = await sharp(logoBuffer).resize(logoSize, logoSize).toBuffer();

  // Real wordmark asset (same file exported from the site's actual header
  // styling), not re-rendered text -- guarantees the exact font/gradient
  // instead of an approximation. Only used small in the corner; the logo
  // mark alone carries the brand in the main block below the photo.
  const wordmarkCornerWidth = 220;
  const wordmarkCorner = await sharp(wordmarkBuffer).resize({ width: wordmarkCornerWidth }).toBuffer();

  const captionLines = wrapText(caption, 30, 4);
  const captionLineHeight = 54;
  const captionStartY = PHOTO_HEIGHT + 40 + logoSize + 80;
  const captionSvg = captionLines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${captionStartY + i * captionLineHeight}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="46" fill="${BRAND_ORANGE}">${escapeXml(line)}</text>`
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
      { input: logo, top: PHOTO_HEIGHT + 40, left: Math.round(WIDTH / 2 - logoSize / 2) },
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return new NextResponse(new Uint8Array(composited), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(composited.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
