import type { Metadata } from "next";
import { CookiesPageClient } from "../_legal-client";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Read the Valtriox Cookie Policy. Learn about the cookies we use, why we use them, and how you can control cookie preferences.",
  alternates: {
    canonical: "https://valtriox.com/cookies",
  },
  openGraph: {
    title: "Cookie Policy | Valtriox",
    description:
      "Read the Valtriox Cookie Policy. Learn about the cookies we use and how you can control cookie preferences.",
    url: "https://valtriox.com/cookies",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return <CookiesPageClient />;
}
