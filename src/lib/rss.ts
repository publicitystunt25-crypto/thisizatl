import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [["source", "sourceName"]],
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
  const feed = await parser.parseURL(FEED_URL);
  return (feed.items || []).map((item) => {
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
