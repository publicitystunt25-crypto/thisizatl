import Link from "next/link";
import Image from "next/image";
import { CATEGORIES } from "@/lib/categories";

const SOCIAL_LINKS = [
  {
    href: "https://www.facebook.com/Thisizatl",
    label: "Facebook",
    path: "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z",
  },
  {
    href: "https://www.instagram.com/thisizatl",
    label: "Instagram",
    path: "M12 2c2.71 0 3.05.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.07.06 1.41.06 4.13s-.01 3.05-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.76c-.55.55-1.1.9-1.76 1.15-.64.25-1.37.42-2.43.47-1.07.05-1.41.06-4.12.06s-3.05-.01-4.13-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.05 2 14.71 2 12s.01-3.05.06-4.13c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 0 1 5.44 2.53c.64-.25 1.37-.42 2.43-.47C8.95 2.01 9.29 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.86.04-1.33.18-1.64.3-.41.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.64C4.29 8.53 4.28 8.85 4.28 12s.01 3.47.06 4.52c.04.86.18 1.33.3 1.64.16.41.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.64.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.86-.04 1.33-.18 1.64-.3.41-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.64.05-1.05.06-1.37.06-4.52s-.01-3.47-.06-4.52c-.04-.86-.18-1.33-.3-1.64a2.73 2.73 0 0 0-.66-1.02 2.73 2.73 0 0 0-1.02-.66c-.31-.12-.78-.26-1.64-.3C14.99 3.81 14.67 3.8 12 3.8Zm0 3.05a5.15 5.15 0 1 1 0 10.3 5.15 5.15 0 0 1 0-10.3Zm0 1.8a3.35 3.35 0 1 0 0 6.7 3.35 3.35 0 0 0 0-6.7Zm5.35-1.98a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z",
  },
];

export default function SiteHeader({
  activeCategory,
}: {
  activeCategory?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-cream/90 backdrop-blur">
      <div className="grid h-20 grid-cols-3 items-center bg-ink px-6">
        <Link href="/" className="flex items-center gap-2 justify-self-start">
          <Image src="/logo.png" alt="ThisIzATL" width={64} height={64} priority />
        </Link>

        <Link
          href="/"
          className="font-display justify-self-center bg-gradient-to-r from-brand-red via-brand to-brand-red bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl"
        >
          ThisIzATL
        </Link>

        <div className="flex items-center gap-4 justify-self-end">
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="text-brand transition-colors hover:text-white"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d={s.path} />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-6 py-2">
        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/"
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              !activeCategory
                ? "bg-ink text-white"
                : "text-zinc-600 hover:bg-cream-100"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/?category=${c}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === c
                  ? "bg-brand text-white"
                  : "text-zinc-600 hover:bg-cream-100"
              }`}
            >
              {c}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        <Link
          href="/"
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
            !activeCategory ? "bg-ink text-white" : "text-zinc-600"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/?category=${c}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              activeCategory === c ? "bg-brand text-white" : "text-zinc-600"
            }`}
          >
            {c}
          </Link>
        ))}
      </nav>
    </header>
  );
}
