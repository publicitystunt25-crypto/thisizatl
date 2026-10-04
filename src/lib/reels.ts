import { GRAPH_BASE } from "@/lib/social";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createReelContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string,
  collaborators?: string[]
): Promise<{ id: string } | { error: string }> {
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: true,
    access_token: token,
  };
  if (coverUrl) body.cover_url = coverUrl;
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
}): Promise<string> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!igUserId || !token) throw new Error("Instagram isn't configured on the server.");

  let result = await createReelContainer(igUserId, token, params.videoUrl, params.caption, params.coverUrl, params.collaborators);
  if ("error" in result && params.collaborators.length > 0) {
    console.error(
      `Reel collaborator invite failed for [${params.collaborators.join(", ")}], retrying without:`,
      result.error
    );
    result = await createReelContainer(igUserId, token, params.videoUrl, params.caption, params.coverUrl);
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
