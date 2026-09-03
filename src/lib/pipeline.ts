import { fetchAtlantaMusicFeed, FeedItem } from "./rss";
import { resolveGoogleNewsLink, extractArticleText } from "./extract";
import { generateArticle, SourceInput } from "./generate";
import { checkDuplicate } from "./dedup";
import { fetchStockPhoto } from "./image";
import { hasSeenLink, markLinkSeen, insertPost, getRecentPostTitles } from "./db";

const STOPWORDS = new Set([
  "the", "a", "an", "in", "on", "at", "of", "for", "to", "and", "or", "is",
  "are", "was", "were", "with", "after", "over", "his", "her", "its", "s",
]);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function clusterItems(items: FeedItem[]): FeedItem[][] {
  const clusters: { words: Set<string>; items: FeedItem[] }[] = [];
  for (const item of items) {
    const words = significantWords(item.title);
    const match = clusters.find((c) => similarity(c.words, words) >= 0.4);
    if (match) {
      match.items.push(item);
    } else {
      clusters.push({ words, items: [item] });
    }
  }
  return clusters.map((c) => c.items);
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) +
    "-" +
    Date.now().toString(36)
  );
}

export interface PipelineLogEntry {
  status: "published" | "skipped" | "error";
  title: string;
  detail: string;
}

export async function runPipeline(maxClusters = 5): Promise<PipelineLogEntry[]> {
  const log: PipelineLogEntry[] = [];
  const items = await fetchAtlantaMusicFeed();
  const seenFlags = await Promise.all(items.map((i) => hasSeenLink(i.link)));
  const unseen = items.filter((_, idx) => !seenFlags[idx]);

  if (unseen.length === 0) {
    log.push({ status: "skipped", title: "-", detail: "No new items in feed" });
    return log;
  }

  const clusters = clusterItems(unseen).slice(0, maxClusters);
  const recentTitles = await getRecentPostTitles(7);

  for (const cluster of clusters) {
    const primary = cluster[0];
    try {
      const sources: SourceInput[] = [];
      for (const item of cluster.slice(0, 3)) {
        const finalUrl = await resolveGoogleNewsLink(item.link);
        const extracted = await extractArticleText(finalUrl);
        if (extracted) {
          sources.push({
            title: item.title,
            url: finalUrl,
            source: item.source,
            text: extracted.text,
          });
        }
        await markLinkSeen(item.link);
      }

      if (sources.length === 0) {
        log.push({
          status: "skipped",
          title: primary.title,
          detail: "Could not extract readable article text from any source in this cluster",
        });
        continue;
      }

      const dup = await checkDuplicate(
        cluster.map((i) => i.title),
        recentTitles
      );
      if (dup.is_duplicate) {
        log.push({
          status: "skipped",
          title: primary.title,
          detail: `Duplicate of already-published "${dup.duplicate_of}": ${dup.reason}`,
        });
        continue;
      }

      const generated = await generateArticle(sources);

      if (!generated.title || !generated.body) {
        log.push({
          status: "skipped",
          title: primary.title,
          detail: "Claude returned an incomplete article (missing title or body) for this source material",
        });
        continue;
      }

      const sourceCredits = sources.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
      }));

      const photo = await fetchStockPhoto(generated.image_query);

      await insertPost({
        slug: slugify(generated.title),
        title: generated.title,
        body: generated.body,
        sources: sourceCredits,
        similarity_note: `${generated.similarity_risk.toUpperCase()}: ${generated.similarity_note}`,
        image_url: photo?.url ?? null,
        image_credit_name: photo?.credit_name ?? null,
        image_credit_url: photo?.credit_url ?? null,
      });

      recentTitles.push(generated.title);

      log.push({
        status: "published",
        title: generated.title,
        detail: `similarity risk: ${generated.similarity_risk}; ${sources.length} source(s)`,
      });
    } catch (err) {
      log.push({
        status: "error",
        title: primary.title,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return log;
}
