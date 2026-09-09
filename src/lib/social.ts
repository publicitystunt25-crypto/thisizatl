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

// Real Instagram usernames: 1-30 chars, letters/digits/periods/underscores.
// Guards against someone pasting an entire paragraph (bio, EPK text) into
// the Instagram field -- without this, that text would get treated as a
// "bare handle" and turned into a broken instagram.com/<giant text> URL,
// which then shows up as a dead "Follow on Instagram" link on the article
// itself, not just a failed tag attempt.
const VALID_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

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
  if (!handle || !VALID_HANDLE.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

// Pulls the @handle out of a full Instagram profile URL
// ("https://instagram.com/handle" / "https://www.instagram.com/handle/?x=1"
// -> "handle"). Returns null if it doesn't look like an Instagram URL.
// Lowercased because Meta's tagging API is case-sensitive against the
// username as stored (lowercase), even though instagram.com's own URLs
// are case-insensitive -- an artist submitting "ROBJOFFICIAL" would
// otherwise get "invalid username" and silently fail the whole tag.
export function extractInstagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)instagram\.com$/.test(parsed.hostname)) return null;
    const handle = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls a media container's processing status. Instagram fetches and
// transcodes the image asynchronously after creation -- publishing before
// status_code reaches FINISHED fails with a transient "not ready" error.
// Gives up after ~20s (image fetch/processing is normally sub-second to a
// few seconds) so a stuck container can't hang the whole share indefinitely.
async function waitForContainerReady(creationId: string, token: string): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${token}`
    );
    if (res.ok) {
      const { status_code: status } = (await res.json()) as { status_code: string };
      if (status === "FINISHED") return;
      if (status === "ERROR") throw new Error("Instagram container processing failed");
    }
    await sleep(1500);
  }
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

  // Instagram needs a moment to fetch/process the container's image before
  // it's publishable -- publishing immediately after creation intermittently
  // fails with "Media ID is not available... not ready for publishing".
  // Poll status_code until it's FINISHED (or ERROR/timeout) before publishing.
  await waitForContainerReady(creationId, token);

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
