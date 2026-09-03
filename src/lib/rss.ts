import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [["source", "sourceName"]],
  },
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  },
});

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const FEED_URL =
  "https://news.google.com/rss/search?q=atlanta+music&hl=en-US&gl=US&ceid=US:en";

export async function fetchAtlantaMusicFeed(): Promise<FeedItem[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const feed = await parser.parseURL(FEED_URL);
      return mapItems(feed.items || []);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

function mapItems(items: Parser.Item[]): FeedItem[] {
  return items.map((item) => {
    const raw = item as unknown as { sourceName?: { _?: string } | string };
    const sourceName =
      typeof raw.sourceName === "string"
        ? raw.sourceName
        : raw.sourceName?._;
    return {
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || "",
      source: sourceName || extractSourceFromTitle(item.title || ""),
    };
  });
}

function extractSourceFromTitle(title: string): string {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts[parts.length - 1] : "Unknown";
}
