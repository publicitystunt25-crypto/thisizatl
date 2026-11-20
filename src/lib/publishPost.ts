import { revalidatePath } from "next/cache";
import {
  clearSchedule,
  getPostById,
  setIgFeedShared,
  setIgMediaId,
  setSocialShared,
  updatePost,
} from "./db";
import { sendArticleLiveNotification } from "./email";
import { generateFeedCaption } from "./generate";
import { postToInstagramFeed, resolveInstagramHandles, shareNewPost } from "./social";

// Publishes a draft or scheduled post: marks it live, shares it to the
// Facebook Page and as an Instagram story, and emails the submitter that it's
// live. Shared by the admin's Approve button and the submitter's own
// "Approve & Go Live Now" on the review page -- callers check who's allowed to
// do it before calling.
export async function publishPostNow(id: number): Promise<void> {
  const post = await getPostById(id);
  if (!post) throw new Error("Post not found");

  // Guards against double-posting to Facebook/Instagram if this fires twice
  // for the same click -- e.g. a slow request getting silently retried by the
  // browser or a proxy. A post that's already published has nothing left to do.
  if (post.status === "published") return;

  await updatePost(id, {
    slug: post.slug,
    title: post.title,
    body: post.body,
    category: post.category,
    status: "published",
  });

  const { instagramHandle } = resolveInstagramHandles(post);

  const result = await shareNewPost({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    instagramHandle,
  });
  await setSocialShared(post.id, result.ok, result.fbPostId);
  await clearSchedule(post.id);

  if (post.submitter_email) {
    try {
      await sendArticleLiveNotification(post.submitter_email, post.image_credit || "there", post.title, post.slug);
    } catch (err) {
      console.error("Article-live notification email failed:", err);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

// Posts a published article to the Instagram Feed (not just the Story) with a
// Claude-written caption, a collaborator invite to the artist's account, and
// @mentions for anyone to tag. Does nothing if it's already been posted or has
// no picture. Shared by the admin's Accept All and by client approvals.
export async function shareToInstagramFeed(id: number): Promise<void> {
  const post = await getPostById(id);
  if (!post || post.status !== "published" || post.ig_feed_shared || !post.image_url) return;

  const { instagramHandle, collaboratorHandles } = resolveInstagramHandles(post);
  const baseCaption = await generateFeedCaption({
    title: post.title,
    body: post.body,
    instagramHandle,
  });

  let tagHandles: string[] = [];
  try {
    tagHandles = post.tag_handles ? (JSON.parse(post.tag_handles) as string[]) : [];
  } catch {
    tagHandles = [];
  }
  const invited = new Set([instagramHandle, ...collaboratorHandles].filter(Boolean));
  const toTag = tagHandles.filter((h) => !invited.has(h));
  const caption = toTag.length ? `${baseCaption}

${toTag.map((h) => "@" + h).join(" ")}` : baseCaption;

  const feedResult = await postToInstagramFeed({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    instagramHandle,
    collaboratorHandles,
    caption,
  });
  if (feedResult.mediaId) await setIgMediaId(post.id, feedResult.mediaId);
  // Only mark it shared if Instagram actually took it, so the admin's button stays for a retry.
  if (feedResult.ok) await setIgFeedShared(post.id, true);
  else console.error("Instagram feed post was not published for post", post.id);
}

// Runs the feed post without making the person who approved wait for
// Instagram; a failure is logged and the admin can retry from the post row.
export function shareToInstagramFeedInBackground(id: number): void {
  void shareToInstagramFeed(id).catch((err) => console.error("Instagram feed publish failed:", err));
}
