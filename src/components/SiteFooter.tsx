import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/advertise", label: "Advertise" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center">
        <Link href="/">
          <Image src="/logo.png" alt="ThisIzATL" width={90} height={90} />
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium text-zinc-300">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand">
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
