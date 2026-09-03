import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
});

const SITE_URL = "https://thisizatl.onrender.com";
const DESCRIPTION =
  "Atlanta music and culture news, written and published automatically.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ThisIzATL",
    template: "%s | ThisIzATL",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "ThisIzATL",
    title: "ThisIzATL",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/logo.png", width: 1200, height: 1200, alt: "ThisIzATL" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ThisIzATL",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream">{children}</body>
    </html>
  );
}
