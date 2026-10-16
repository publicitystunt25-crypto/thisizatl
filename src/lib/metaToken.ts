// The access token saved in FB_PAGE_ACCESS_TOKEN doesn't have to be the
// Page token itself: Facebook will hand over the Page's own token to anyone
// holding a login that manages the Page. Posting to a Page as the Page
// requires the Page token, so this asks for it (and falls back to the saved
// token if that doesn't work, so a real Page token keeps working as before).
// That means the token in Render can be the long-lived login token and the
// Page token never has to be copied over by hand.
const GRAPH = "https://graph.facebook.com/v26.0";
const SUCCESS_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;

let cache: { source: string; token: string; until: number } | null = null;

export async function getPageToken(): Promise<string | undefined> {
  const saved = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!saved) return undefined;
  if (!pageId) return saved;

  if (cache && cache.source === saved && cache.until > Date.now()) return cache.token;

  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${encodeURIComponent(saved)}`);
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      if (data.access_token) {
        cache = { source: saved, token: data.access_token, until: Date.now() + SUCCESS_TTL_MS };
        return data.access_token;
      }
    }
  } catch (err) {
    console.error("Couldn't look up the Page token:", err);
  }

  // Use the saved token as-is. Remember that for a minute so a bad token
  // doesn't trigger a lookup on every single call.
  cache = { source: saved, token: saved, until: Date.now() + FAILURE_TTL_MS };
  return saved;
}
