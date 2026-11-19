import { getPageToken } from "@/lib/metaToken";
import { GRAPH_BASE, extractUntaggableUsername } from "@/lib/social";
import { waitForReelReady } from "@/lib/reels";

// Instagram allows up to 20 slides in one carousel.
export const MAX_CAROUSEL_SLIDES = 20;

// Posts a feed carousel whose first slide is a cover image and whose other
// slides are video clips. Each slide is created as its own container (videos
// take a while for Instagram to download and process), then they're tied
// together and published. Collaborators that Instagram refuses are dropped one
// at a time, like the Reel flow does, so one private account can't sink the post.
export async function postVideoCarousel(params: {
  coverUrl: string;
  videoUrls: string[];
  caption: string;
  collaborators: string[];
  onProgress?: (message: string) => void;
}): Promise<string> {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = await getPageToken();
  if (!igUserId || !token) throw new Error("Instagram isn't configured on the server.");
  if (params.videoUrls.length < 1 || params.videoUrls.length + 1 > MAX_CAROUSEL_SLIDES) {
    throw new Error(`A carousel needs a cover plus 1 to ${MAX_CAROUSEL_SLIDES - 1} clips.`);
  }

  const create = async (body: Record<string, unknown>): Promise<{ id: string } | { error: string }> => {
    const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: token }),
    });
    if (!res.ok) return { error: await res.text() };
    return (await res.json()) as { id: string };
  };

  const total = params.videoUrls.length + 1;
  const children: string[] = [];

  params.onProgress?.(`Preparing slide 1 of ${total} (cover)`);
  const cover = await create({ image_url: params.coverUrl, is_carousel_item: true });
  if ("error" in cover) throw new Error(`Instagram rejected the cover slide: ${cover.error}`);
  await waitForReelReady(cover.id, token, 2 * 60 * 1000);
  children.push(cover.id);

  for (let i = 0; i < params.videoUrls.length; i++) {
    params.onProgress?.(`Instagram is processing clip ${i + 1} of ${params.videoUrls.length}`);
    const item = await create({
      media_type: "VIDEO",
      video_url: params.videoUrls[i],
      is_carousel_item: true,
    });
    if ("error" in item) throw new Error(`Instagram rejected clip ${i + 1}: ${item.error}`);
    try {
      await waitForReelReady(item.id, token, 6 * 60 * 1000);
    } catch (err) {
      throw new Error(`Clip ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
    children.push(item.id);
  }

  params.onProgress?.("Putting the carousel together");
  const parent: Record<string, unknown> = {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: params.caption,
  };
  let remaining = [...new Set(params.collaborators)];
  let result = await create(remaining.length ? { ...parent, collaborators: remaining } : parent);
  while ("error" in result && remaining.length > 0) {
    const bad = extractUntaggableUsername(result.error);
    if (bad && remaining.includes(bad)) {
      console.error(`Carousel collaborator @${bad} can't be tagged, retrying with the rest:`, result.error);
      remaining = remaining.filter((u) => u !== bad);
      result = await create(remaining.length ? { ...parent, collaborators: remaining } : parent);
    } else {
      console.error(`Carousel collaborator invite failed for [${remaining.join(", ")}], retrying without any:`, result.error);
      result = await create(parent);
      break;
    }
  }
  if ("error" in result) throw new Error(`Instagram rejected the carousel: ${result.error}`);
  await waitForReelReady(result.id, token, 2 * 60 * 1000);

  params.onProgress?.("Publishing");
  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: result.id, access_token: token }),
  });
  if (!publishRes.ok) {
    throw new Error(`Instagram carousel publish failed: ${publishRes.status} ${await publishRes.text()}`);
  }
  return ((await publishRes.json()) as { id: string }).id;
}
