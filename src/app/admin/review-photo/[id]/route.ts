import { NextResponse } from "next/server";
import { getReviewPhoto } from "@/lib/db";

// A replacement photo a submitter sent with a change request. Sits under
// /admin, so the middleware already requires the admin login.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const image = await getReviewPhoto(photoId);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600" },
  });
}
