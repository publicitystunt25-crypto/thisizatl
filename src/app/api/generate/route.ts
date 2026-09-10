import { NextResponse } from "next/server";
import { runPipeline, publishDueScheduledPosts } from "@/lib/pipeline";
import { replyToNewComments } from "@/lib/comments";

export async function POST() {
  let publishedScheduled: { id: number; title: string }[] = [];
  try {
    publishedScheduled = await publishDueScheduledPosts();
  } catch (err) {
    console.error("Publishing scheduled posts failed:", err);
  }

  let commentSweep = { replied: 0, errors: 0 };
  try {
    commentSweep = await replyToNewComments();
  } catch (err) {
    console.error("Comment reply sweep failed:", err);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local", publishedScheduled, commentSweep },
      { status: 500 }
    );
  }
  try {
    // Each scheduled trigger publishes at most 1 article -- the daily total
    // (4) comes from running 4 times a day, not from one run publishing many.
    const log = await runPipeline(1);
    return NextResponse.json({ log, publishedScheduled, commentSweep });
  } catch (err) {
    console.error("Pipeline failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), publishedScheduled, commentSweep },
      { status: 500 }
    );
  }
}
