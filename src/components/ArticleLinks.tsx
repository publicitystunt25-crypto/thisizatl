export interface SourceCredit {
  title: string;
  url: string;
  source: string;
}

// Artist-submission spotlights store their Instagram/music links in the same
// `sources` field as rewritten-news credits, but they should read as a
// personal call-to-action ("Follow X on Instagram"), not a generic
// attribution box -- this is how we tell the two apart.
function isArtistLinks(sources: SourceCredit[]): boolean {
  const tags = sources.map((s) => s.source);
  return tags.includes("Instagram") && tags.includes("Music");
}

export default function ArticleLinks({
  sources,
  artistName,
}: {
  sources: SourceCredit[];
  artistName?: string | null;
}) {
  if (sources.length === 0) return null;

  if (isArtistLinks(sources)) {
    const instagram = sources.find((s) => s.source === "Instagram");
    const music = sources.find((s) => s.source === "Music");
    const name = artistName || "the artist";

    return (
      <div className="mt-8 space-y-2 text-[17px] leading-relaxed">
        {instagram && (
          <p>
            <a
              href={instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-dark hover:underline"
            >
              Follow {name} on Instagram
            </a>
          </p>
        )}
        {music && (
          <p>
            <a
              href={music.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-dark hover:underline"
            >
              Check out {name}&rsquo;s music here
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
      <p className="font-semibold text-ink">Sources</p>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-dark hover:underline"
            >
              {s.source}: {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
