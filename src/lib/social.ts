const GRAPH_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SITE_URL = process.env.SITE_URL || "https://thisizatl.com";

export interface SocialPost {
  id: number;
  title: string;
  slug: string;
  image_url: string | null;
  // Instagram @handle (no @, no URL) to tag/mention in the Story, e.g. for
  // artist-submitted spotlights -- tagged accounts must be public.
  instagramHandle?: string | null;
}

// Pulls the @handle out of a full Instagram profile URL
// ("https://instagram.com/handle" / "https://www.instagram.com/handle/?x=1"
// -> "handle"). Returns null if it doesn't look like an Instagram URL.
export function extractInstagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)instagram\.com$/.test(parsed.hostname)) return null;
    const handle = parsed.pathname.split("/").filter(Boolean)[0];
    return handle || null;
  } catch {
    return null;
  }
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

  const body: Record<string, unknown> = {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: token,
  };
  // Tagged accounts must be public, or Instagram silently drops the tag
  // rather than erroring -- this is a best-effort mention, not guaranteed.
  // x/y are required for the tag to render as a visible mention sticker on
  // the Story (omitting them attaches the tag as metadata only, with no
  // visible sticker) -- placed near the top, clear of the headline/CTA text
  // burned into the bottom of the image.
  if (post.instagramHandle) {
    body.user_tags = [{ username: post.instagramHandle, x: 0.5, y: 0.08 }];
  }

  const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

// Failures here should never break the main post-publishing flow, so every
// error is caught and logged -- but the caller gets a boolean back so it can
// record share status on the post instead of the failure vanishing silently.
export async function shareNewPost(post: SocialPost): Promise<boolean> {
  const results = await Promise.allSettled([
    postToFacebookPage(post),
    postToInstagramStory(post),
  ]);

  let allOk = true;
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Social share failed:", result.reason);
      allOk = false;
    }
  }
  return allOk;
}
