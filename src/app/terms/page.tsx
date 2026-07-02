import type { Metadata } from "next";
import { TermsPageClient } from "../_legal-client";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Valtriox Terms of Service. Understand the terms and conditions that govern your use of the Valtriox platform and services.",
  alternates: {
    canonical: "https://valtriox.com/terms",
  },
  openGraph: {
    title: "Terms of Service | Valtriox",
    description:
      "Read the Valtriox Terms of Service. Understand the terms and conditions that govern your use of the Valtriox platform.",
    url: "https://valtriox.com/terms",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <TermsPageClient />;
}
