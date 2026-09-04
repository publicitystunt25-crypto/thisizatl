import { Pool } from "pg";
import { cache } from "react";

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

      ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'News';
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_data BYTEA;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_mime TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS author TEXT;
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
  category: string;
  status: "draft" | "published";
  author: string | null;
  created_at: string;
}

export async function insertPost(post: {
  slug: string;
  title: string;
  body: string;
  sources: { title: string; url: string; source: string }[];
  similarity_note: string | null;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
  category: string;
  status?: "draft" | "published";
  author?: string | null;
}): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(
    `INSERT INTO posts (slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      post.slug,
      post.title,
      post.body,
      JSON.stringify(post.sources),
      post.similarity_note,
      post.image_url,
      post.image_credit_name,
      post.image_credit_url,
      post.category,
      post.status ?? "published",
      post.author ?? null,
    ]
  );
  return res.rows[0].id;
}

export async function updatePost(
  id: number,
  post: {
    slug: string;
    title: string;
    body: string;
    category: string;
    status: "draft" | "published";
    image_url?: string | null;
  }
): Promise<void> {
  await ensureInit();
  if (post.image_url !== undefined) {
    await pool.query(
      `UPDATE posts SET slug = $1, title = $2, body = $3, category = $4, status = $5, image_url = $6
       WHERE id = $7`,
      [post.slug, post.title, post.body, post.category, post.status, post.image_url, id]
    );
  } else {
    await pool.query(
      `UPDATE posts SET slug = $1, title = $2, body = $3, category = $4, status = $5
       WHERE id = $6`,
      [post.slug, post.title, post.body, post.category, post.status, id]
    );
  }
}

export async function setPostImage(
  id: number,
  data: Buffer,
  mime: string,
  imageUrl: string
): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET image_data = $1, image_mime = $2, image_url = $3,
     image_credit_name = NULL, image_credit_url = NULL WHERE id = $4`,
    [data, mime, imageUrl, id]
  );
}

export async function getPostImage(
  id: number
): Promise<{ data: Buffer; mime: string } | undefined> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM posts WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  if (!row || !row.image_data) return undefined;
  return { data: row.image_data, mime: row.image_mime };
}

export async function deletePost(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
}

export async function getAllPosts(category?: string): Promise<Post[]> {
  await ensureInit();
  if (category) {
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at
       FROM posts WHERE category = $1 AND status = 'published' ORDER BY created_at DESC`,
      [category]
    );
    return res.rows;
  }
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at
     FROM posts WHERE status = 'published' ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getAllPostsAdmin(): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at
     FROM posts ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getPostById(id: number): Promise<Post | undefined> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at
     FROM posts WHERE id = $1`,
    [id]
  );
  return res.rows[0];
}

export const getPostBySlug = cache(
  async (slug: string): Promise<Post | undefined> => {
    await ensureInit();
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at
       FROM posts WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    return res.rows[0];
  }
);

export async function getTodayPostCount(): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM posts WHERE created_at >= date_trunc('day', now()) AND status = 'published'`
  );
  return parseInt(res.rows[0].count, 10);
}

export async function getRecentPostTitles(days = 7): Promise<string[]> {
  await ensureInit();
  const res = await pool.query<{ title: string }>(
    `SELECT title FROM posts WHERE created_at >= now() - ($1 || ' days')::interval AND status = 'published' ORDER BY created_at DESC`,
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
