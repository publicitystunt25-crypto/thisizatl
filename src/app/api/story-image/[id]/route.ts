import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPostById } from "@/lib/db";

const WIDTH = 1080;
const HEIGHT = 1920;

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
  _req: Request,
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

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Source image unavailable" }, { status: 502 });
  }
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const background = await sharp(imgBuffer)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
    .toBuffer();

  const headlineLines = wrapText(post.title, 28, 5);
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
      <text x="64" y="${ctaY}" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="#ff7a45">Read full story on thisizatl.com</text>
    </svg>
  `;

  const composited = await sharp(background)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return new NextResponse(new Uint8Array(composited), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
