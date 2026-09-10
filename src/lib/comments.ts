import { getRecentIgMediaIds, hasRepliedToComment, markCommentReplied } from "./db";
import { getMediaComments, replyToComment } from "./social";

const REPLY_EMOJI = "🍑";

// Sweeps every post published to the Instagram feed in the last 30 days for
// top-level comments that haven't been replied to yet, and replies with a
// peach to each one. Runs on the same hourly cron trigger as article
// generation -- there's no webhook endpoint set up for instant replies, so a
// comment gets its peach on the next hourly run, not immediately.
export async function replyToNewComments(): Promise<{ replied: number; errors: number }> {
  const posts = await getRecentIgMediaIds();
  let replied = 0;
  let errors = 0;

  for (const post of posts) {
    const comments = await getMediaComments(post.ig_media_id);

    for (const comment of comments) {
      if (await hasRepliedToComment(comment.id)) continue;
      try {
        await replyToComment(comment.id, REPLY_EMOJI);
        await markCommentReplied(comment.id);
        replied++;
      } catch (err) {
        console.error(`Replying to comment ${comment.id} (post ${post.id}) failed:`, err);
        errors++;
      }
    }
  }

  return { replied, errors };
}
