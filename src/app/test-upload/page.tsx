import type { Metadata } from "next";
import { testUploadAction } from "./actions";

export const metadata: Metadata = {
  title: "Upload Test",
  robots: { index: false, follow: false },
};

export default function TestUploadPage() {
  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Upload Test</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
        Bare-bones photo upload, no other fields, no processing -- just to see whether an upload of a
        given size makes it to the server at all.
      </p>

      <form action={testUploadAction} encType="multipart/form-data" style={{ marginTop: 24 }}>
        <input type="file" name="photo" accept="image/*" required />
        <button
          type="submit"
          style={{
            display: "block",
            marginTop: 16,
            padding: "10px 20px",
            background: "#ff5a1f",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Upload
        </button>
      </form>
    </main>
  );
}
