import Link from "next/link";
import Image from "next/image";
import { CATEGORIES } from "@/lib/categories";

export default function SiteHeader({
  activeCategory,
}: {
  activeCategory?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="ThisIzATL" width={40} height={40} priority />
          <span className="font-display text-xl font-bold tracking-tight text-zinc-900">
            ThisIzATL
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/"
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              !activeCategory
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
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
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
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
            !activeCategory ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/?category=${c}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              activeCategory === c ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            {c}
          </Link>
        ))}
      </nav>
    </header>
  );
}
