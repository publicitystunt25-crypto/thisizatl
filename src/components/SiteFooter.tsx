import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-cream-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="ThisIzATL" width={28} height={28} />
          <span className="font-display text-sm font-bold">
            <span className="text-ink">ThisIz</span>
            <span className="text-brand">ATL</span>
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Atlanta music and culture news, written and published automatically
          by Claude. Every post credits and links its original source(s).
        </p>
      </div>
    </footer>
  );
}
