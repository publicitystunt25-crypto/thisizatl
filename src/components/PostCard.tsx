import Link from "next/link";
import Image from "next/image";
import CategoryBadge from "./CategoryBadge";
import type { Post } from "@/lib/db";

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
        {post.image_url ? (
          <Image
            src={post.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300">
            <Image src="/logo.png" alt="" width={48} height={48} className="opacity-40" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <CategoryBadge category={post.category} />
        <h3 className="font-display mt-2 text-lg font-semibold leading-snug text-zinc-900 group-hover:underline">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-zinc-600">
          {post.body}
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          {new Date(post.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </Link>
  );
}
