import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TrustedSubmitView from "../s/TrustedSubmitView";
import { getTrustedSubmitterBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request Coverage",
  robots: { index: false, follow: false },
};

export default async function TiaSubmitPage() {
  const submitter = await getTrustedSubmitterBySlug("tia");
  if (!submitter) notFound();
  return <TrustedSubmitView submitter={submitter} />;
}
