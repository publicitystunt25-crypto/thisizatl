import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TrustedSubmitView from "../TrustedSubmitView";
import { getTrustedSubmitter } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Partner Submission",
  robots: { index: false, follow: false },
};

export default async function TrustedSubmitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const submitter = await getTrustedSubmitter(token);
  if (!submitter) notFound();
  return <TrustedSubmitView submitter={submitter} />;
}
