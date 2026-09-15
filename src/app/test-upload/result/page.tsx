import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Upload Test Result",
  robots: { index: false, follow: false },
};

export default async function TestUploadResultPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; name?: string; type?: string }>;
}) {
  const { size, name, type } = await searchParams;
  const bytes = size ? Number(size) : null;

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>It reached the server</h1>
      <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
        <strong>File:</strong> {name || "(unknown)"}
        <br />
        <strong>Type:</strong> {type || "(unknown)"}
        <br />
        <strong>Size:</strong> {bytes !== null ? `${bytes.toLocaleString()} bytes (${(bytes / 1024).toFixed(1)} KB)` : "(unknown)"}
      </p>
      <Link href="/test-upload" style={{ display: "inline-block", marginTop: 24, color: "#ff5a1f" }}>
        &larr; Try another
      </Link>
    </main>
  );
}
