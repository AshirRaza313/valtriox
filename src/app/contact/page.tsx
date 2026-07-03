import type { Metadata } from "next";
import { ContactPage } from "@/components/brandflow/landing/ContactPage";
import { PlatformIdentityProvider } from "@/lib/platform-identity";

export const metadata: Metadata = {
  title: "Contact Valtriox | Email, Phone, Address & Free Strategy Session",
  description:
    "Contact Valtriox: Email ashir@valtriox.com, Call +92-318 3916019, Visit Karachi, Pakistan. Book a free 30-minute strategy session with founder Muhammad Ashir Raza. Mon-Fri 9AM-6PM PKT.",
  keywords: [
    "contact Valtriox",
    "Valtriox email",
    "Valtriox phone",
    "Valtriox address",
    "ashir@valtriox.com",
    "+92-318 3916019",
    "Karachi Pakistan",
    "free strategy session",
    "Muhammad Ashir Raza",
    "brand management consultation",
  ],
  alternates: {
    canonical: "https://valtriox.com/contact",
  },
  openGraph: {
    title: "Contact Valtriox | Free 30-Minute Strategy Session",
    description:
      "Email ashir@valtriox.com  ·  Call +92-318 3916019  ·  Visit Karachi, Pakistan. Book a free 30-minute strategy session with founder Muhammad Ashir Raza.",
    url: "https://valtriox.com/contact",
    type: "website",
    images: [
      {
        url: "/valtriox-icon-512.png",
        width: 512,
        height: 512,
        alt: "Valtriox logo — contact us",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Valtriox | Free 30-Minute Strategy Session",
    description:
      "Email ashir@valtriox.com  ·  Call +92-318 3916019  ·  Visit Karachi, Pakistan.",
    images: ["/valtriox-icon-512.png"],
  },
  // Extra metadata Google reads for entity disambiguation
  other: {
    "contact:email": "ashir@valtriox.com",
    "contact:phone_number": "+92-318-3916019",
    "contact:country_name": "Pakistan",
    "contact:locality": "Karachi",
    "business:contact_data:country_name": "Pakistan",
    "business:contact_data:locality": "Karachi",
    "business:contact_data:email": "ashir@valtriox.com",
    "business:contact_data:phone_number": "+92-318-3916019",
  },
};

// Page-specific JSON-LD: ContactPage schema tells Google this page is
// about contacting the business. Combined with the global LocalBusiness
// schema in layout.tsx, this gives search engines an unambiguous signal
// that /contact is the canonical place to surface Valtriox's contact info.
const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  url: "https://valtriox.com/contact",
  name: "Contact Valtriox",
  description:
    "Get in touch with Valtriox. Email ashir@valtriox.com, call +92-318 3916019, or visit Karachi, Pakistan. Book a free 30-minute strategy session with founder Muhammad Ashir Raza.",
  mainEntity: {
    "@type": "Organization",
    name: "Valtriox",
    url: "https://valtriox.com",
    email: "ashir@valtriox.com",
    telephone: "+923183916019",
    founder: {
      "@type": "Person",
      name: "Muhammad Ashir Raza",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Karachi",
      addressRegion: "Sindh",
      addressCountry: "PK",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "ashir@valtriox.com",
      telephone: "+923183916019",
      areaServed: ["PK", "Worldwide"],
      availableLanguage: ["English", "Urdu"],
      hoursAvailable: "Mon-Fri, 09:00-18:00 (PKT, UTC+5)",
    },
  },
};

export default function Contact() {
  return (
    <PlatformIdentityProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      {/*
        SSR-rendered contact details block — this is what Google's crawler
        sees on the FIRST HTML response (before any client-side JS runs).
        Wraps the 4 key contact facts in semantic <address> markup so search
        engines and AI systems can extract them unambiguously.
        Visually hidden (sr-only) so it doesn't duplicate the cards below.
      */}
      <address
        className="sr-only"
        itemScope
        itemType="https://schema.org/LocalBusiness"
      >
        <h2>Contact Valtriox</h2>
        <p>
          Valtriox is a universal brand operating system founded by Muhammad
          Ashir Raza, headquartered in Karachi, Pakistan. You can reach the
          Valtriox team using the contact details below.
        </p>
        <ul>
          <li>
            <strong>Email:</strong>{" "}
            <a href="mailto:ashir@valtriox.com" itemProp="email">
              ashir@valtriox.com
            </a>
          </li>
          <li>
            <strong>Phone:</strong>{" "}
            <a href="tel:+923183916019" itemProp="telephone">
              +92-318 3916019
            </a>
          </li>
          <li>
            <strong>Address:</strong>{" "}
            <span itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
              <span itemProp="addressLocality">Karachi</span>,{" "}
              <span itemProp="addressRegion">Sindh</span>,{" "}
              <span itemProp="addressCountry">Pakistan</span>
            </span>
          </li>
          <li>
            <strong>Support Hours:</strong> Monday to Friday, 9:00 AM to 6:00 PM
            (PKT, UTC+5)
          </li>
          <li>
            <strong>Free 30-Minute Strategy Session:</strong> Book a free
            30-minute strategy session with founder Muhammad Ashir Raza to
            discuss how Valtriox can streamline your brand&apos;s operations,
            orders, inventory, and marketing.
          </li>
          <li>
            <strong>Founder:</strong>{" "}
            <span itemProp="founder" itemScope itemType="https://schema.org/Person">
              <span itemProp="name">Muhammad Ashir Raza</span>
            </span>
          </li>
          <li>
            <strong>Website:</strong>{" "}
            <a href="https://valtriox.com" itemProp="url">
              https://valtriox.com
            </a>
          </li>
        </ul>
      </address>
      <ContactPage />
    </PlatformIdentityProvider>
  );
}
