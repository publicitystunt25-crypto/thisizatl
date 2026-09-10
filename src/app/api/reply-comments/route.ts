import { NextResponse } from "next/server";
import { replyToNewComments } from "@/lib/comments";

// Separate, faster-polling trigger from /api/generate -- comment replies
// benefit from checking every few minutes, but the article-generation
// pipeline on /api/generate shouldn't run that often (it burns Claude API
// calls and is gated by a daily post limit tied to hourly ticks).
export async function POST() {
  try {
    const result = await replyToNewComments();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Comment reply sweep failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
