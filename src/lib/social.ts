const GRAPH_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SITE_URL = process.env.SITE_URL || "https://thisizatl.com";

export interface SocialPost {
  id: number;
  title: string;
  slug: string;
  image_url: string | null;
}

async function postToFacebookPage(post: SocialPost): Promise<void> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return;

  const url = `${SITE_URL}/posts/${post.slug}`;
  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: post.title,
      link: url,
      access_token: token,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Facebook post failed: ${res.status} ${body}`);
  }
}

async function postToInstagramStory(post: SocialPost): Promise<void> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!igUserId || !token || !post.image_url) return;

  // Composited server-side: original photo + headline + "read full story" CTA
  // burned into the image, since Instagram's API doesn't support link stickers.
  const imageUrl = `${SITE_URL}/api/story-image/${post.id}`;

  const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      media_type: "STORIES",
      access_token: token,
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Instagram story container failed: ${createRes.status} ${body}`);
  }

  const { id: creationId } = (await createRes.json()) as { id: string };

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: token,
    }),
  });

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(`Instagram story publish failed: ${publishRes.status} ${body}`);
  }
}

// Fire-and-forget from the caller's perspective: failures here should never
// break the main post-publishing flow, so every error is caught and logged.
export async function shareNewPost(post: SocialPost): Promise<void> {
  const results = await Promise.allSettled([
    postToFacebookPage(post),
    postToInstagramStory(post),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Social share failed:", result.reason);
    }
  }
}
