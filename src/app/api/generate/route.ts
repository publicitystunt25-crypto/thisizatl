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
    const log = await runPipeline();
    return NextResponse.json({ log });
  } catch (err) {
    console.error("Pipeline failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
