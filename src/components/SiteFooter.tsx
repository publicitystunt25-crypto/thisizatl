import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/advertise", label: "Advertise" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-cream-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="ThisIzATL" width={28} height={28} />
          <span className="font-display text-sm font-bold">
            <span className="text-ink">ThisIz</span>
            <span className="text-brand">ATL</span>
          </span>
        </div>

        <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-dark">
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="max-w-xs text-xs text-zinc-500">
          Atlanta music, entertainment, and culture news. Every post credits
          and links its original source(s).
        </p>
      </div>
    </footer>
  );
}
