import { hasRepliedToComment, markCommentReplied } from "./db";
import { getRecentAccountMedia, getMediaComments, replyToComment } from "./social";

const REPLY_EMOJI = "🍑";
const SWEEP_WINDOW_DAYS = 30;

// Sweeps every post on the connected Instagram account from the last 30
// days -- whether it was published through this app or posted manually
// straight from Instagram -- for top-level comments that haven't been
// replied to yet, and replies with a peach to each one. Runs on the same
// hourly cron trigger as article generation -- there's no webhook endpoint
// set up for instant replies, so a comment gets its peach on the next
// hourly run, not immediately.
export async function replyToNewComments(): Promise<{ replied: number; errors: number }> {
  const cutoff = Date.now() - SWEEP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const media = await getRecentAccountMedia();
  const recentMedia = media.filter((m) => new Date(m.timestamp).getTime() >= cutoff);

  let replied = 0;
  let errors = 0;

  for (const item of recentMedia) {
    const comments = await getMediaComments(item.id);

    for (const comment of comments) {
      if (await hasRepliedToComment(comment.id)) continue;
      try {
        await replyToComment(comment.id, REPLY_EMOJI);
        await markCommentReplied(comment.id);
        replied++;
      } catch (err) {
        console.error(`Replying to comment ${comment.id} (media ${item.id}) failed:`, err);
        errors++;
      }
    }
  }

  return { replied, errors };
}
