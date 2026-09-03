import * as cheerio from "cheerio";

export interface ExtractedArticle {
  finalUrl: string;
  text: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Google News RSS links point at an interstitial page, not the real article.
// The real URL is resolved by replaying the same batchexecute call the
// news.google.com web client makes client-side.
export async function resolveGoogleNewsLink(link: string): Promise<string> {
  try {
    const url = new URL(link);
    const pathParts = url.pathname.split("/");
    const isGoogleNewsArticle =
      url.hostname === "news.google.com" &&
      ["articles", "read"].includes(pathParts[pathParts.length - 2]);
    if (!isGoogleNewsArticle) return link;

    const base64Str = pathParts[pathParts.length - 1];

    const paramsRes = await fetch(
      `https://news.google.com/rss/articles/${base64Str}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!paramsRes.ok) return link;
    const html = await paramsRes.text();

    const sigMatch = html.match(/data-n-a-sg="([^"]+)"/);
    const tsMatch = html.match(/data-n-a-ts="([^"]+)"/);
    if (!sigMatch || !tsMatch) return link;
    const signature = sigMatch[1];
    const timestamp = tsMatch[1];

    const payload = [
      "Fbv4je",
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${timestamp},"${signature}"]`,
    ];

    const decodeRes = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": USER_AGENT,
        },
        body: `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
      }
    );
    if (!decodeRes.ok) return link;
    const decodeText = await decodeRes.text();
    const dataLine = decodeText.split("\n\n")[1];
    const decodedUrl = JSON.parse(JSON.parse(dataLine)[0][2])[1] as string;
    return decodedUrl || link;
  } catch {
    return link;
  }
}

export async function extractArticleText(
  url: string
): Promise<ExtractedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();

    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    const paragraphs = container
      .find("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40);

    const text = paragraphs.join("\n\n");
    if (!text || text.length < 200) return null;

    return { finalUrl: res.url || url, text: text.slice(0, 8000) };
  } catch {
    return null;
  }
}
