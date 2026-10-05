import { NextResponse } from "next/server";
import sharp from "sharp";
import { getGalleryImageBytes } from "@/lib/db";

// An extra photo from an article, cropped to the same 4:5 size as the branded
// feed image so it can sit next to it as a slide in an Instagram carousel
// (every slide gets cropped to the first one's shape, so matching it up front
// keeps the crop under our control). The top is kept, because that's where
// names and headers usually sit in screenshots.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const image = await getGalleryImageBytes(Number(id));
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slide = await sharp(image.data)
    .resize(1080, 1350, { fit: "cover", position: "north" })
    .jpeg({ quality: 92 })
    .toBuffer();

  return new NextResponse(new Uint8Array(slide), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
