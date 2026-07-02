import type { Metadata } from "next";
import { RefundPageClient } from "../_legal-client";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Read the Valtriox Refund Policy. Understand our refund and cancellation terms for subscriptions and services.",
  alternates: {
    canonical: "https://valtriox.com/refund",
  },
  openGraph: {
    title: "Refund Policy | Valtriox",
    description:
      "Read the Valtriox Refund Policy. Understand our refund and cancellation terms for subscriptions and services.",
    url: "https://valtriox.com/refund",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function RefundPage() {
  return <RefundPageClient />;
}
