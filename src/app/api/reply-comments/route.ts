import { NextResponse } from "next/server";
import { replyToNewComments } from "@/lib/comments";

// Separate, faster-polling trigger from /api/generate -- comment replies
// benefit from checking every few minutes, but the article-generation
// pipeline on /api/generate shouldn't run that often (it burns Claude API
// calls and is gated by a daily post limit tied to hourly ticks).
//
// Fire-and-forget rather than awaiting the sweep before responding: simple
// external schedulers (cron-job.org and similar) give up waiting after a
// short timeout, and every single run was logging "Failed (timeout)" even
// though the sweep itself was often still completing on the server
// afterward. Since this runs on a persistent server rather than a
// serverless function with a hard execution cutoff, work kicked off here
// keeps running after the response is sent -- so the caller's timeout can
// no longer affect whether comments actually get replied to.
//
// The in-progress guard also prevents pile-up if the trigger ever fires
// again before the previous sweep finished (exactly what happened when a
// real network outage made one sweep run long: a schedule with no minimum
// gap kept layering fresh, overlapping sweeps on top of it, all competing
// for the same small database connection pool, until nothing completed).
let sweepInProgress = false;

export async function POST() {
  if (sweepInProgress) {
    return NextResponse.json({ skipped: "a sweep is already in progress" });
  }

  sweepInProgress = true;
  replyToNewComments()
    .catch((err) => {
      console.error("Comment reply sweep failed:", err);
    })
    .finally(() => {
      sweepInProgress = false;
    });

  return NextResponse.json({ started: true });
}
