import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let initialized: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initialized) {
    initialized = pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sources TEXT NOT NULL,
        similarity_note TEXT,
        image_url TEXT,
        image_credit_name TEXT,
        image_credit_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS seen_links (
        link TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `).then(() => undefined);
  }
  return initialized;
}

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

export async function insertPost(post: {
  slug: string;
  title: string;
  body: string;
  sources: { title: string; url: string; source: string }[];
  similarity_note: string;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
}): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO posts (slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      post.slug,
      post.title,
      post.body,
      JSON.stringify(post.sources),
      post.similarity_note,
      post.image_url,
      post.image_credit_name,
      post.image_credit_url,
    ]
  );
}

export async function getAllPosts(): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT * FROM posts ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  await ensureInit();
  const res = await pool.query<Post>(`SELECT * FROM posts WHERE slug = $1`, [
    slug,
  ]);
  return res.rows[0];
}

export async function getRecentPostTitles(days = 7): Promise<string[]> {
  await ensureInit();
  const res = await pool.query<{ title: string }>(
    `SELECT title FROM posts WHERE created_at >= now() - ($1 || ' days')::interval ORDER BY created_at DESC`,
    [days]
  );
  return res.rows.map((r) => r.title);
}

export async function hasSeenLink(link: string): Promise<boolean> {
  await ensureInit();
  const res = await pool.query(`SELECT 1 FROM seen_links WHERE link = $1`, [
    link,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function markLinkSeen(link: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO seen_links (link) VALUES ($1) ON CONFLICT (link) DO NOTHING`,
    [link]
  );
}

export default pool;
