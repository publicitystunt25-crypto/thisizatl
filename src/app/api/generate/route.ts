import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }
  try {
    // Each scheduled trigger publishes at most 1 article -- the daily total
    // (4) comes from running 4 times a day, not from one run publishing many.
    const log = await runPipeline(1);
    return NextResponse.json({ log });
  } catch (err) {
    console.error("Pipeline failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
