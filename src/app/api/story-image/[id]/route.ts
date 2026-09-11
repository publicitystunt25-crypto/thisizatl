import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPostById } from "@/lib/db";
import { cropToFocus } from "@/lib/crop";
import { escapeXml, wrapText } from "@/lib/textOverlay";

const WIDTH = 1080;
const HEIGHT = 1920;

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

  // Optional ?caption= override -- same as the feed-image route, for a
  // headline that shouldn't show something in the raw title (e.g. an
  // artist not wanting a specific detail highlighted on the graphic).
  const { searchParams } = new URL(req.url);
  const headline = searchParams.get("caption") || post.title;

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Source image unavailable" }, { status: 502 });
  }
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  // Detected face focus (when available) takes priority over the blind
  // attention-based crop -- attention can fixate on high-contrast background
  // elements (graffiti text, signage) instead of the actual subject, which is
  // what happened here before this was wired up (Kendricke Brown's Story
  // showed a wall and a jacket sleeve, no face at all).
  const focus =
    post.focus_x != null && post.focus_y != null
      ? { x: post.focus_x, y: post.focus_y }
      : null;
  const background = await cropToFocus(imgBuffer, WIDTH, HEIGHT, focus);

  const headlineLines = wrapText(headline, 28, 5);
  const lineHeight = 64;
  const gradientHeight = 200 + headlineLines.length * lineHeight;
  const textBlockTop = HEIGHT - gradientHeight + 60;

  const headlineSvg = headlineLines
    .map(
      (line, i) =>
        `<text x="64" y="${textBlockTop + i * lineHeight}" font-family="Arial, sans-serif" font-weight="800" font-size="52" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join("");

  const ctaY = textBlockTop + headlineLines.length * lineHeight + 20;

  const overlaySvg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <rect x="0" y="${HEIGHT - gradientHeight}" width="${WIDTH}" height="${gradientHeight}" fill="url(#fade)" />
      ${headlineSvg}
      <text x="64" y="${ctaY}" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="#ff7a45">Read full story on ThisIzATL.com</text>
    </svg>
  `;

  const composited = await sharp(background)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return new NextResponse(new Uint8Array(composited), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(composited.length),
      // no-store: this composite gets re-fetched by Meta at post time, and a
      // cached stale response can otherwise serve an outdated version even
      // after the code has been fixed and redeployed.
      "Cache-Control": "no-store",
    },
  });
}
