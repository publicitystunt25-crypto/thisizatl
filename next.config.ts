import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // opencv-wasm's Emscripten glue code locates its .wasm binary relative to
  // its own file location -- bundling it breaks that lookup, so it needs to
  // stay a plain Node require instead.
  serverExternalPackages: ["opencv-wasm"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
