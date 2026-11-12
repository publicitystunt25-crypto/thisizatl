// Runs once when the server starts. Starts the site's background jobs on
// timers so nothing depends on an outside scheduler pinging the /api routes
// (those routes still work the same way if one ever does):
//   - comment replies, every 5 minutes
//   - admin-scheduled posts going live, every 5 minutes
//   - finding and publishing Atlanta news, at most once every 2 hours during
//     the day (the daily cap in pipeline.ts still limits how many go up)
const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_DELAY_MS = 60 * 1000;
const PIPELINE_EVERY_MS = 2 * 60 * 60 * 1000;
const PIPELINE_LAST_RUN_KEY = "pipeline_last_run_at";

// New stories only go up between 7 AM and 11 PM Atlanta time.
function isDaytimeInNewYork(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date())
  );
  return hour >= 7 && hour < 23;
}

export async function register() {
  // Only the long-running production server; skip the Edge runtime and dev.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const { replyToNewComments } = await import("@/lib/comments");
  const { runPipeline, publishDueScheduledPosts } = await import("@/lib/pipeline");
  const { getSetting, setSetting } = await import("@/lib/db");
  const { sendDueRevisionEmails } = await import("@/lib/reviewRevision");

  // A job that's still running when the next tick fires is left alone, so runs
  // never pile up on the small database connection pool.
  const running = new Set<string>();
  async function guarded(name: string, job: () => Promise<void>) {
    if (running.has(name)) return;
    running.add(name);
    try {
      await job();
    } catch (err) {
      console.error(`${name} failed:`, err);
    } finally {
      running.delete(name);
    }
  }

  async function runNewsPipeline() {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.NEWSAPI_KEY) return;
    if (!isDaytimeInNewYork()) return;
    // The last run time is saved, so a restart (every deploy) doesn't start an
    // extra run right away.
    const last = await getSetting(PIPELINE_LAST_RUN_KEY);
    if (last && Date.now() - new Date(last).getTime() < PIPELINE_EVERY_MS) return;
    await setSetting(PIPELINE_LAST_RUN_KEY, new Date().toISOString());

    const log = await runPipeline(1);
    for (const entry of log) {
      console.log(`News pipeline [${entry.status}] ${entry.title}: ${entry.detail}`);
    }
  }

  const tick = () => {
    void guarded("Comment reply sweep", async () => {
      await replyToNewComments();
    });
    void guarded("Scheduled post publishing", async () => {
      const published = await publishDueScheduledPosts();
      if (published.length > 0) console.log(`Published ${published.length} scheduled post(s).`);
    });
    void guarded("Review revision emails", async () => {
      await sendDueRevisionEmails();
    });
    void guarded("News pipeline", runNewsPipeline);
  };

  setTimeout(() => {
    tick();
    setInterval(tick, TICK_MS);
  }, FIRST_TICK_DELAY_MS);
}
