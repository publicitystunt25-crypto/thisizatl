import { NextResponse } from "next/server";
import { getVideoSubmission } from "@/lib/db";
import { renderClipCover, coverResponse } from "@/lib/clipCover";

// Review-page preview of the cover. Sits under /admin, so the middleware
// already requires the admin login; ?h= is the headline being edited.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const submission = await getVideoSubmission(Number(id));
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const headline = (new URL(req.url).searchParams.get("h") ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  const cover = await renderClipCover(submission.video_public_id, headline || "Your headline here");
  if (!cover) return NextResponse.json({ error: "Frame unavailable" }, { status: 502 });
  return coverResponse(cover);
}
