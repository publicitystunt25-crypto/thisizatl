import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // Temporary: Render's platform-level WAF is blocking any submission with a
  // photo over ~34KB, unrelated to anything in this app's own code (confirmed
  // via a bare-bones test page with zero processing). Send /submit traffic to
  // the identical form running on Vercel, which doesn't have this problem,
  // until Render resolves it. Remove this once that's fixed.
  async redirects() {
    return [
      {
        source: "/submit",
        destination: "https://thisizatl.vercel.app/submissions",
        permanent: false,
      },
      {
        // The writer form now includes a photo upload, which hits the same
        // Render WAF issue as /submit -- send writers to the identical form
        // on Vercel instead. Remove alongside the /submit redirect above
        // once Render fixes the WAF.
        source: "/writer/:path*",
        destination: "https://thisizatl.vercel.app/writer/:path*",
        permanent: false,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
      // Next.js rejects a Server Action POST with a 403 if the browser's
      // Origin header doesn't exactly match the host it thinks it's running
      // on (CSRF protection) -- Render serves this app on multiple domains
      // (the custom domain, www, and the default onrender.com URL), so any
      // submitter landing on one of the non-default ones got a 403 on every
      // submit regardless of device. This is what "This page couldn't load"
      // on /submit actually was.
      allowedOrigins: ["thisizatl.com", "www.thisizatl.com", "thisizatl.onrender.com"],
    },
  },
};

export default nextConfig;
