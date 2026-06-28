import type { Metadata } from "next";
import { ContactPage } from "@/components/brandflow/landing/ContactPage";
import { PlatformIdentityProvider } from "@/lib/platform-identity";

export const metadata: Metadata = {
  title: "Contact Us | Valtriox | COMMAND YOUR BRAND UNIVERSE",
  description: "Get in touch with Valtriox. Request a free consultation, ask questions, or explore partnership opportunities. We're here to help your brand grow.",
  keywords: ["contact", "support", "brand management", "Valtriox", "consultation"],
};

export default function Contact() {
  return (
    <PlatformIdentityProvider>
      <ContactPage />
    </PlatformIdentityProvider>
  );
}
