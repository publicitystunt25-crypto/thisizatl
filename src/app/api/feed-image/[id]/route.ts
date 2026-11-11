import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPostById } from "@/lib/db";
import { cropToFocus } from "@/lib/crop";
import { escapeXml, wrapText, fitsWithinLines } from "@/lib/textOverlay";

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_HEIGHT = 880;
const BRAND_ORANGE = "#ff5a1f";
const BRAND_RED = "#e8342a";

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

  // Optional ?zoom=<multiplier> -- manual zoom-in on top of the normal
  // cover-fit crop, for photos with a lot of empty background padding
  // around the subject (e.g. a cutout-style PNG) that a plain crop can't
  // tighten in on by itself.
  const zoomParam = searchParams.get("zoom");
  const zoom = zoomParam !== null ? Number(zoomParam) : 1;

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
  const photo = await cropToFocus(imgBuffer, WIDTH, PHOTO_HEIGHT, focus, zoom);

  // The headline gets the biggest font that still fits. For each size from
  // large to small this works out how many characters fit across a line, wraps
  // the full headline at that width, and keeps the first size where the lines
  // (plus the logo underneath) fit in the space below the divider. Headlines
  // are never truncated -- a very long one just ends up at the smallest size.
  // The logo shrinks as the headline gets taller, same as before.
  const TEXT_WIDTH = 1000;
  // Average glyph width / font size for the bold headline font. Smaller sizes are used for long headlines,
  // which wrap into more lines with more chance of a wide line, so they get extra side margin.
  const charWidthRatio = (fontSize: number) => (fontSize >= 62 ? 0.54 : 0.6);
  const LINE_HEIGHT_RATIO = 1.12;
  const MAX_FONT = 115;
  const MIN_FONT = 46;
  const logoForLines = (lines: number) => (lines <= 2 ? 150 : lines === 3 ? 130 : lines === 4 ? 110 : 95);
  const spaceBelowDivider = HEIGHT - 18 - (PHOTO_HEIGHT + 30) - 12 - 14;
  const pickTier = () => {
    for (let fontSize = MAX_FONT; fontSize >= MIN_FONT; fontSize -= 2) {
      const maxCharsPerLine = Math.floor(TEXT_WIDTH / (fontSize * charWidthRatio(fontSize)));
      for (let maxLines = 1; maxLines <= 5; maxLines++) {
        if (!fitsWithinLines(caption, maxCharsPerLine, maxLines)) continue;
        const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO);
        const logoSize = logoForLines(maxLines);
        if (maxLines * lineHeight + 8 + logoSize <= spaceBelowDivider) {
          return { fontSize, lineHeight, maxCharsPerLine, maxLines, logoSize };
        }
        break;
      }
    }
    const fontSize = MIN_FONT;
    return {
      fontSize,
      lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO),
      maxCharsPerLine: Math.floor(TEXT_WIDTH / (fontSize * charWidthRatio(fontSize))),
      maxLines: 5,
      logoSize: logoForLines(5),
    };
  };
  const tier = pickTier();
  const captionLines = wrapText(caption, tier.maxCharsPerLine, tier.maxLines);
  const captionLineHeight = tier.lineHeight;
  const captionFontSize = tier.fontSize;
  const logoSize = tier.logoSize;

  const logo = await sharp(logoBuffer).resize(logoSize, logoSize).toBuffer();

  // Real wordmark asset (same file exported from the site's actual header
  // styling), not re-rendered text -- guarantees the exact font/gradient
  // instead of an approximation. Only used small in the corner; the logo
  // mark alone carries the brand in the main block below the photo.
  const wordmarkCornerWidth = 220;
  const wordmarkCorner = await sharp(wordmarkBuffer).resize({ width: wordmarkCornerWidth }).toBuffer();

  // Caption text first, logo mark below it -- both centered together within
  // the space below the divider.
  const captionToLogoGap = 8;
  const topGap = 12;
  const bottomMargin = 18;
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
