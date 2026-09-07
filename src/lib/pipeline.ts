import { fetchAtlantaMusicFeed, FeedItem } from "./rss";
import { resolveGoogleNewsLink, extractArticleText } from "./extract";
import { generateArticle, SourceInput } from "./generate";
import { checkDuplicate } from "./dedup";
import { fetchStockPhoto } from "./image";
import { shareNewPost, extractInstagramHandle } from "./social";
import { sendArticleLiveNotification } from "./email";
import {
  hasSeenLink,
  markLinkSeen,
  insertPost,
  getRecentPostTitles,
  getTodayPostCount,
  setSocialShared,
  getDueScheduledPosts,
  markPublishedFromSchedule,
} from "./db";
import { slugify } from "./slug";

const DAILY_POST_LIMIT = 4;

function dailyPostLimit(): number {
  return DAILY_POST_LIMIT;
}

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

export interface PipelineLogEntry {
  status: "published" | "skipped" | "error";
  title: string;
  detail: string;
}

export async function runPipeline(maxClusters = 6): Promise<PipelineLogEntry[]> {
  const log: PipelineLogEntry[] = [];

  const dailyLimit = dailyPostLimit();
  const todayCount = await getTodayPostCount();
  const remainingToday = dailyLimit - todayCount;
  if (remainingToday <= 0) {
    log.push({
      status: "skipped",
      title: "-",
      detail: `Daily limit of ${dailyLimit} posts already reached (${todayCount} published today)`,
    });
    return log;
  }

  const items = await fetchAtlantaMusicFeed();
  const seenFlags = await Promise.all(items.map((i) => hasSeenLink(i.link)));
  const unseen = items.filter((_, idx) => !seenFlags[idx]);

  if (unseen.length === 0) {
    log.push({ status: "skipped", title: "-", detail: "No new items in feed" });
    return log;
  }

  const clusters = clusterItems(unseen).slice(0, maxClusters);
  const recentTitles = await getRecentPostTitles(7);
  let publishedCount = 0;

  for (const cluster of clusters) {
    if (publishedCount >= remainingToday) {
      log.push({
        status: "skipped",
        title: cluster[0].title,
        detail: `Daily limit of ${dailyLimit} posts reached for today`,
      });
      continue;
    }
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

      if (!generated.is_locally_relevant) {
        log.push({
          status: "skipped",
          title: primary.title,
          detail: `Not Atlanta/Georgia-relevant: ${generated.relevance_note}`,
        });
        continue;
      }

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
      const slug = slugify(generated.title);

      const newId = await insertPost({
        slug,
        title: generated.title,
        body: generated.body,
        sources: sourceCredits,
        similarity_note: `${generated.similarity_risk.toUpperCase()}: ${generated.similarity_note}`,
        image_url: photo?.url ?? null,
        image_credit_name: photo?.credit_name ?? null,
        image_credit_url: photo?.credit_url ?? null,
        category: generated.category,
        image_width: photo?.width ?? null,
        image_height: photo?.height ?? null,
      });

      const shared = await shareNewPost({ id: newId, title: generated.title, slug, image_url: photo?.url ?? null });
      await setSocialShared(newId, shared);

      recentTitles.push(generated.title);
      publishedCount++;

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

// Called on every hourly pipeline trigger, before generating new articles --
// publishes any admin-scheduled post whose time has arrived. Since this only
// runs on the hourly cron tick, a post goes live within about an hour of its
// scheduled time, not to the minute.
export async function publishDueScheduledPosts(): Promise<{ id: number; title: string }[]> {
  const due = await getDueScheduledPosts();
  const published: { id: number; title: string }[] = [];

  for (const post of due) {
    await markPublishedFromSchedule(post.id);

    let instagramHandle: string | null = null;
    try {
      const sources = JSON.parse(post.sources) as { source: string; url: string }[];
      const igSource = sources.find((s) => s.source === "Instagram");
      instagramHandle = extractInstagramHandle(igSource?.url);
    } catch {
      // sources isn't valid JSON or doesn't include an Instagram entry -- fine.
    }

    const shared = await shareNewPost({
      id: post.id,
      title: post.title,
      slug: post.slug,
      image_url: post.image_url,
      instagramHandle,
    });
    await setSocialShared(post.id, shared);

    if (post.submitter_email) {
      try {
        await sendArticleLiveNotification(post.submitter_email, post.image_credit || "there", post.title, post.slug);
      } catch (err) {
        console.error("Article-live notification email failed:", err);
      }
    }

    published.push({ id: post.id, title: post.title });
  }

  return published;
}
