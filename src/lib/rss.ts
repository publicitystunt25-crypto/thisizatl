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

const NEWSAPI_URL =
  "https://newsapi.org/v2/everything?q=atlanta%20music&language=en&sortBy=publishedAt&pageSize=50";

export async function fetchAtlantaMusicFeed(): Promise<FeedItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("NEWSAPI_KEY is not set");
  }

  const res = await fetch(NEWSAPI_URL, {
    headers: { "X-Api-Key": apiKey },
  });
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
