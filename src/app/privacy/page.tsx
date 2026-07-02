import type { Metadata } from "next";
import { PrivacyPageClient } from "../_legal-client";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the Valtriox Privacy Policy. Learn how we collect, use, disclose, and safeguard your information when you use the Valtriox platform.",
  alternates: {
    canonical: "https://valtriox.com/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Valtriox",
    description:
      "Read the Valtriox Privacy Policy. Learn how we collect, use, disclose, and safeguard your information.",
    url: "https://valtriox.com/privacy",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
