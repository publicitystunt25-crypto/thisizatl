import { NextResponse } from "next/server";
import { getCoverageRequestImage } from "@/lib/db";

// A photo attached to a coverage request. Sits under /admin, so the
// middleware already requires the admin login.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const imageId = Number(id);
  if (!Number.isInteger(imageId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const image = await getCoverageRequestImage(imageId);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600" },
  });
}
