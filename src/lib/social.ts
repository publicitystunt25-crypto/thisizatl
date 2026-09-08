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
  // Set when a previous share attempt already posted to Facebook
  // successfully (e.g. a retry after only Instagram failed) -- skips
  // re-posting to Facebook so a retry can't create a duplicate there.
  existingFbPostId?: string | null;
}

// Accepts whatever an artist typed into the Instagram field -- a bare
// handle ("lkwkai17", "@lkwkai17") or a full profile URL, with or without
// "https://" -- and normalizes it to a full URL so it can be stored and
// used downstream (extractInstagramHandle, article links) unchanged.
export function normalizeInstagramInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed.replace(/^@/, "");

  if (/^https?:\/\//i.test(stripped)) return stripped;
  if (/(^|\.)instagram\.com/i.test(stripped)) {
    return `https://${stripped.replace(/^\/+/, "")}`;
  }

  const handle = stripped.replace(/^\/+|\/+$/g, "");
  return handle ? `https://instagram.com/${handle}` : null;
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

async function postToFacebookPage(post: SocialPost): Promise<string | null> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return null;

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

  const { id } = (await res.json()) as { id: string };
  return id;
}

// Instagram's Graph API has no endpoint to delete published media (Stories
// included) -- Content Publishing is publish-only. Stories also auto-expire
// after 24h regardless. Facebook feed posts, however, can be deleted.
export async function deleteFacebookPost(fbPostId: string): Promise<boolean> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return false;

  const res = await fetch(`${GRAPH_BASE}/${fbPostId}?access_token=${token}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Facebook post delete failed:", res.status, body);
    return false;
  }
  return true;
}

// Attempts to create the Story container, optionally with a user_tags
// mention. Meta rejects the *entire* container -- not just the tag -- if the
// tagged account can't be tagged (private, invalid, or their own "who can
// tag me" setting restricted), so a bad tag would otherwise fail the whole
// Story. Returns the creation id, or null if the request failed.
async function createStoryContainer(
  imageUrl: string,
  token: string,
  igUserId: string,
  userTag?: { username: string; x: number; y: number }
): Promise<{ id: string } | { error: string }> {
  const body: Record<string, unknown> = {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: token,
  };
  if (userTag) {
    body.user_tags = [userTag];
  }

  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { error: await res.text() };
  }
  const { id } = (await res.json()) as { id: string };
  return { id };
}

async function postToInstagramStory(post: SocialPost): Promise<void> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!igUserId || !token || !post.image_url) return;

  // Composited server-side: original photo + headline + "read full story" CTA
  // burned into the image, since Instagram's API doesn't support link stickers.
  const imageUrl = `${SITE_URL}/api/story-image/${post.id}`;

  // x/y are required for the tag to render as a visible mention sticker on
  // the Story (omitting them attaches the tag as metadata only, with no
  // visible sticker) -- placed near the top, clear of the headline/CTA text
  // burned into the bottom of the image.
  const userTag = post.instagramHandle
    ? { username: post.instagramHandle, x: 0.5, y: 0.08 }
    : undefined;

  let result = await createStoryContainer(imageUrl, token, igUserId, userTag);

  if ("error" in result && userTag) {
    console.error(
      `Instagram tag failed for @${userTag.username}, retrying without tag:`,
      result.error
    );
    result = await createStoryContainer(imageUrl, token, igUserId);
  }

  if ("error" in result) {
    throw new Error(`Instagram story container failed: ${result.error}`);
  }

  const { id: creationId } = result;

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

export interface ShareResult {
  ok: boolean;
  fbPostId: string | null;
}

// Failures here should never break the main post-publishing flow, so every
// error is caught and logged -- but the caller gets a result back so it can
// record share status (and the Facebook post id, for later deletion) instead
// of the failure vanishing silently.
export async function shareNewPost(post: SocialPost): Promise<ShareResult> {
  const results = await Promise.allSettled([
    post.existingFbPostId ? Promise.resolve(post.existingFbPostId) : postToFacebookPage(post),
    postToInstagramStory(post),
  ]);

  let ok = true;
  let fbPostId: string | null = null;
  const [fbResult, igResult] = results;

  if (fbResult.status === "fulfilled") {
    fbPostId = fbResult.value;
  } else {
    console.error("Social share failed:", fbResult.reason);
    ok = false;
  }
  if (igResult.status === "rejected") {
    console.error("Social share failed:", igResult.reason);
    ok = false;
  }

  return { ok, fbPostId };
}
