import { getPageToken } from "@/lib/metaToken";
import { GRAPH_BASE, extractUntaggableUsername } from "@/lib/social";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createReelContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string,
  collaborators?: string[],
  userTags?: string[]
): Promise<{ id: string } | { error: string }> {
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: true,
    access_token: token,
  };
  if (coverUrl) body.cover_url = coverUrl;
  // Reels take plain usernames here; a position on the video isn't allowed.
  if (userTags && userTags.length > 0) body.user_tags = userTags.map((username) => ({ username }));
  if (collaborators && collaborators.length > 0) body.collaborators = collaborators;

  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await res.text() };
  const { id } = (await res.json()) as { id: string };
  return { id };
}

// Unlike a photo, Instagram has to download and transcode the video before
// it can be published, which takes anywhere from seconds to a few minutes --
// so this polls for much longer than the photo flow does, and throws on a
// timeout instead of publishing something that isn't ready.
async function waitForReelReady(creationId: string, token: string, maxWaitMs: number): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code,status&access_token=${token}`
    );
    if (res.ok) {
      const data = (await res.json()) as { status_code?: string; status?: string };
      if (data.status_code === "FINISHED") return;
      if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
        throw new Error(`Instagram couldn't process the video: ${data.status || data.status_code}`);
      }
    }
    await sleep(5000);
  }
  throw new Error("Instagram took too long to process the video. It was not posted -- try again.");
}

// Posts a Reel and returns its Instagram media id. Collaborators are invited
// the same way as feed posts; if Instagram rejects the invite (private or
// ineligible account) the Reel still goes out without it rather than failing.
export async function postReel(params: {
  videoUrl: string;
  coverUrl?: string;
  caption: string;
  collaborators: string[];
  tags?: string[];
}): Promise<string> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = await getPageToken();
  if (!igUserId || !token) throw new Error("Instagram isn't configured on the server.");

  // One account that can't be tagged (private, not a Business/Creator
  // profile) makes Instagram reject the whole request. Instagram names the bad
  // one, so drop just that account and retry with the rest. If the error
  // doesn't name anyone, drop the tags first and then the collaborators, so
  // the Reel still goes out.
  let remaining = [...new Set(params.collaborators)];
  let tags = [...new Set(params.tags ?? [])];
  const attempt = () =>
    createReelContainer(igUserId, token, params.videoUrl, params.caption, params.coverUrl, remaining, tags);
  let result = await attempt();
  while ("error" in result && (remaining.length > 0 || tags.length > 0)) {
    const bad = extractUntaggableUsername(result.error);
    if (bad && remaining.includes(bad)) {
      console.error(`Reel collaborator @${bad} can't be tagged, retrying with the rest:`, result.error);
      remaining = remaining.filter((u) => u !== bad);
    } else if (bad && tags.includes(bad)) {
      console.error(`Reel tag @${bad} can't be applied, retrying with the rest:`, result.error);
      tags = tags.filter((u) => u !== bad);
    } else if (tags.length > 0) {
      console.error(`Reel tags failed for [${tags.join(", ")}], retrying without tags:`, result.error);
      tags = [];
    } else {
      console.error(`Reel collaborator invite failed for [${remaining.join(", ")}], retrying without any:`, result.error);
      remaining = [];
    }
    result = await attempt();
  }
  if ("error" in result) throw new Error(`Instagram rejected the Reel: ${result.error}`);

  await waitForReelReady(result.id, token, 8 * 60 * 1000);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: result.id, access_token: token }),
  });
  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed: ${publishRes.status} ${await publishRes.text()}`);
  }
  const { id } = (await publishRes.json()) as { id: string };
  return id;
}
