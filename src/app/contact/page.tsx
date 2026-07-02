import type { Metadata } from "next";
import { ContactPage } from "@/components/brandflow/landing/ContactPage";
import { PlatformIdentityProvider } from "@/lib/platform-identity";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Valtriox. Request a free consultation, ask questions, or explore partnership opportunities. We're here to help your brand grow.",
  keywords: ["contact", "support", "brand management", "Valtriox", "consultation"],
  alternates: {
    canonical: "https://valtriox.com/contact",
  },
  openGraph: {
    title: "Contact Us | Valtriox",
    description:
      "Get in touch with Valtriox. Request a free consultation, ask questions, or explore partnership opportunities.",
    url: "https://valtriox.com/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | Valtriox",
    description:
      "Get in touch with Valtriox. Request a free consultation, ask questions, or explore partnership opportunities.",
  },
};

export default function Contact() {
  return (
    <PlatformIdentityProvider>
      <ContactPage />
    </PlatformIdentityProvider>
  );
}
