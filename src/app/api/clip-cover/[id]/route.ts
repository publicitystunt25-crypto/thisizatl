import { NextResponse } from "next/server";
import { getVideoSubmission } from "@/lib/db";
import { renderClipCover, coverResponse } from "@/lib/clipCover";

// Public, because Instagram has to download it. It only ever renders the
// headline that was saved when a clip was approved, and only while that clip
// is being posted -- so it can't be used to make arbitrary images.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const submission = await getVideoSubmission(Number(id));
  if (!submission || submission.status !== "posting" || !submission.headline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const cover = await renderClipCover(submission.video_public_id, submission.headline);
  if (!cover) return NextResponse.json({ error: "Frame unavailable" }, { status: 502 });
  return coverResponse(cover);
}
