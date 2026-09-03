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

// Real Atlanta outlets -- restricting to these (rather than trusting NewsAPI's
// loose full-text keyword matching, which pulls in unrelated global stories
// even for quoted phrases) is what actually guarantees local relevance.
const ATLANTA_DOMAINS = [
  "ajc.com",
  "11alive.com",
  "atlantanewsfirst.com",
  "wsbtv.com",
  "fox5atlanta.com",
  "rollingout.com",
  "creativeloafing.com",
  "atlantamagazine.com",
  "artsatl.org",
  "uatl.com",
  "saportareport.com",
].join(",");

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

export async function fetchAtlantaMusicFeed(): Promise<FeedItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("NEWSAPI_KEY is not set");
  }

  const raw = await fetchQuery(
    {
      domains: ATLANTA_DOMAINS,
      language: "en",
      sortBy: "publishedAt",
      pageSize: "100",
    },
    apiKey
  );

  const seen = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const item of raw) {
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
