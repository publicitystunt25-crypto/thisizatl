import { revalidatePath } from "next/cache";
import { clearSchedule, getPostById, setSocialShared, updatePost } from "./db";
import { sendArticleLiveNotification } from "./email";
import { extractInstagramHandle, shareNewPost } from "./social";

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

  let instagramHandle: string | null = null;
  try {
    const sources = JSON.parse(post.sources) as { source: string; url: string }[];
    const igSource = sources.find((s) => s.source === "Instagram");
    instagramHandle = extractInstagramHandle(igSource?.url);
  } catch {
    // sources isn't valid JSON or doesn't include an Instagram entry -- fine,
    // just means no tag gets attached.
  }

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
