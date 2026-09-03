import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data.sqlite");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sources TEXT NOT NULL,
    similarity_note TEXT,
    image_url TEXT,
    image_credit_name TEXT,
    image_credit_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seen_links (
    link TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
`);

export interface Post {
  id: number;
  slug: string;
  title: string;
  body: string;
  sources: string; // JSON string: {title, url, source}[]
  similarity_note: string | null;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
  created_at: string;
}

export function insertPost(post: {
  slug: string;
  title: string;
  body: string;
  sources: { title: string; url: string; source: string }[];
  similarity_note: string;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
}) {
  const stmt = db.prepare(
    `INSERT INTO posts (slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, created_at)
     VALUES (@slug, @title, @body, @sources, @similarity_note, @image_url, @image_credit_name, @image_credit_url, @created_at)`
  );
  stmt.run({
    slug: post.slug,
    title: post.title,
    body: post.body,
    sources: JSON.stringify(post.sources),
    similarity_note: post.similarity_note,
    image_url: post.image_url,
    image_credit_name: post.image_credit_name,
    image_credit_url: post.image_credit_url,
    created_at: new Date().toISOString(),
  });
}

export function getAllPosts(): Post[] {
  return db
    .prepare(`SELECT * FROM posts ORDER BY created_at DESC`)
    .all() as Post[];
}

export function getPostBySlug(slug: string): Post | undefined {
  return db.prepare(`SELECT * FROM posts WHERE slug = ?`).get(slug) as
    | Post
    | undefined;
}

export function hasSeenLink(link: string): boolean {
  const row = db.prepare(`SELECT 1 FROM seen_links WHERE link = ?`).get(link);
  return !!row;
}

export function markLinkSeen(link: string) {
  db.prepare(
    `INSERT OR IGNORE INTO seen_links (link, created_at) VALUES (?, ?)`
  ).run(link, new Date().toISOString());
}

export default db;
