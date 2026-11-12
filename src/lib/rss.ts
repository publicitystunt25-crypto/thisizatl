export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface NewsApiArticle {
  title: string;
  url: string;
  publishedAt: string;
  source: { name: string };
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
  message?: string;
}

const BASE_URL = "https://newsapi.org/v2/everything";

// Dedicated Atlanta/local outlets -- every story from these is inherently
// Atlanta-relevant, so no extra filtering needed.
const LOCAL_DOMAINS = [
  "ajc.com",
  "11alive.com",
  "atlantanewsfirst.com",
  "wsbtv.com",
  "fox5atlanta.com",
  "creativeloafing.com",
  "atlantamagazine.com",
  "artsatl.org",
  "uatl.com",
  "saportareport.com",
  "hotspotatl.com", // Hot 107.9
  "majicatl.com", // Majic 107.5/97.5
  "streetz945atl.com", // Streetz 94.5
].join(",");

// National urban/celebrity outlets -- these cover far more than Atlanta, so
// results are kept only when the story itself actually mentions Atlanta/ATL.
const NATIONAL_URBAN_DOMAINS = [
  "theshaderoom.com",
  "bossip.com",
  "balleralert.com",
].join(",");

const ATLANTA_MENTION = /\batl(anta)?\b/i;

const MUSIC_KEYWORDS = [
  "music", "concert", "rapper", "rap", "musician", "album", "hip hop",
  "hip-hop", "record label", "festival", "tour", "venue", " dj ", "producer",
  "songwriter", "singer", "band", "song", "single", "ep ", "mixtape",
];

async function fetchQuery(
  params: Record<string, string>,
  apiKey: string
): Promise<FeedItem[]> {
  const url = `${BASE_URL}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  const data = (await res.json()) as NewsApiResponse;

  if (data.status !== "ok") {
    throw new Error(`NewsAPI error: ${data.message || res.statusText}`);
  }

  return (data.articles || []).map((article) => ({
    title: article.title,
    link: article.url,
    pubDate: article.publishedAt,
    source: article.source?.name || "Unknown",
  }));
}

function looksMusicRelated(item: FeedItem): boolean {
  const t = ` ${item.title.toLowerCase()} `;
  return MUSIC_KEYWORDS.some((kw) => t.includes(kw));
}

// Google News search feeds. NewsAPI's free tier only returns a handful of
// recent stories for the local outlets, so this keeps fresh Atlanta music
// stories flowing when that runs dry.
const GOOGLE_NEWS_QUERIES = [
  "atlanta rapper OR atlanta hip hop OR atlanta music when:2d",
  "atlanta concert OR atlanta album OR atlanta festival OR atlanta singer when:2d",
];

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchGoogleNews(query: string): Promise<FeedItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (tag: string) => decodeXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
    const rawTitle = pick("title");
    const source = pick("source") || "Google News";
    const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    const link = pick("link");
    if (!title || !link) continue;
    items.push({ title, link, pubDate: pick("pubDate"), source });
  }
  return items;
}

export async function fetchAtlantaMusicFeed(): Promise<FeedItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("NEWSAPI_KEY is not set");
  }

  const [localRaw, nationalRaw] = await Promise.all([
    fetchQuery(
      {
        domains: LOCAL_DOMAINS,
        language: "en",
        sortBy: "publishedAt",
        pageSize: "80",
      },
      apiKey
    ),
    fetchQuery(
      {
        domains: NATIONAL_URBAN_DOMAINS,
        language: "en",
        sortBy: "publishedAt",
        pageSize: "50",
      },
      apiKey
    ),
  ]);

  const nationalFiltered = nationalRaw.filter((item) =>
    ATLANTA_MENTION.test(item.title)
  );

  const googleRaw = (
    await Promise.all(
      GOOGLE_NEWS_QUERIES.map((q) =>
        fetchGoogleNews(q).catch((err) => {
          console.error("Google News feed failed:", err);
          return [] as FeedItem[];
        })
      )
    )
  ).flat();

  const seen = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const item of [...localRaw, ...nationalFiltered, ...googleRaw]) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    deduped.push(item);
  }

  // Music-related stories first, so they win priority when the pipeline caps
  // how many stories it processes per run.
  const music = deduped.filter(looksMusicRelated);
  const other = deduped.filter((i) => !looksMusicRelated(i));

  return [...music, ...other];
}
