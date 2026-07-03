// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PlatformIdentityProvider } from "@/lib/platform-identity";
import { ReactQueryProvider } from "@/lib/react-query-provider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  themeColor: "#D4A73A",
  width: "device-width",
  initialScale: 1,
 viewportFit: "cover",
  maximumScale: 1,
};

const SITE_URL = "https://valtriox.com";
// SEO: Shortened to <=160 chars so search engines don't truncate.
// Previously 223 chars — Rank Math flagged this in SEO audit.
const SITE_DESCRIPTION =
  "The universal brand operating system for modern businesses. Manage orders, inventory, customers, marketing, and analytics from one powerful platform.";
const SITE_TITLE = "Valtriox | Command Your Brand Universe";
const SITE_OG_TITLE = "Valtriox | Command Your Brand Universe | by Muhammad Ashir Raza";
const SITE_OG_DESCRIPTION =
  "The universal brand operating system founded and built by Muhammad Ashir Raza. Manage orders, inventory, customers, marketing, and analytics from one beautiful dashboard. Made in Pakistan for the world.";
const FOUNDER_LINKEDIN = "https://www.linkedin.com/in/muhammad-ashir-raza";

// ── Real business contact details (single source of truth) ──
// These values are referenced by JSON-LD structured data below so Google
// and other search engines can surface them as a rich contact card in
// search results. They MUST match the values shown in the visible UI
// (Footer, ContactPage, ContactSection, /about).
// If you change any of these, also update:
//   - src/lib/platform-identity.tsx  (DEFAULT_IDENTITY)
//   - src/components/brandflow/landing/ContactPage.tsx
//   - src/components/brandflow/landing/ContactSection.tsx
//   - src/app/api/setup/init/route.ts (DB seed)
const BUSINESS_EMAIL = "ashir@valtriox.com";
const BUSINESS_PHONE_DISPLAY = "+92-318 3916019";        // human-readable
const BUSINESS_PHONE_TEL = "+923183916019";                // E.164 for tel: links
const BUSINESS_ADDRESS_LOCALITY = "Karachi";
const BUSINESS_ADDRESS_REGION = "Sindh";
const BUSINESS_ADDRESS_COUNTRY = "PK";
const BUSINESS_SUPPORT_HOURS = "Mon-Fri, 09:00-18:00 (PKT, UTC+5)";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Valtriox",
  },
  description: SITE_DESCRIPTION,
  keywords: ["Valtriox", "brand management", "universal brand management portal", "order management", "inventory", "team collaboration", "business operations", "SaaS"],
  authors: [{ name: "Muhammad Ashir Raza", url: "https://www.linkedin.com/in/muhammad-ashir-raza" }],
  creator: "Muhammad Ashir Raza",
  publisher: "Valtriox",
  applicationName: "Valtriox",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/valtriox-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/valtriox-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/valtriox-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Valtriox",
  },
  openGraph: {
    title: SITE_OG_TITLE,
    description: SITE_OG_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: "Valtriox",
    locale: "en_US",
    images: [
      {
        url: "/valtriox-icon-512.png",
        width: 512,
        height: 512,
        alt: "Valtriox logo, founded by Muhammad Ashir Raza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_OG_TITLE,
    description: SITE_OG_DESCRIPTION,
    images: ["/valtriox-icon-512.png"],
    creator: "@valtriox",
    site: "@valtriox",
  },
  other: {
    "article:author": "Muhammad Ashir Raza",
    "article:publisher": "Valtriox",
    "profile:first_name": "Muhammad Ashir",
    "profile:last_name": "Raza",
    "profile:username": "muhammad-ashir-raza",
    "founder": "Muhammad Ashir Raza",
    "creator": "Muhammad Ashir Raza",
    // Geo hints — Google reads these for local-business entity association.
    "geo.region": "PK-SD",          // ISO 3166-2 code for Sindh province, Pakistan
    "geo.placename": "Karachi",
    "geo.position": "24.8607;67.0011",
    "ICBM": "24.8607, 67.0011",
    // Business contact hints (Facebook Open Graph business vocabulary)
    "business:contact_data:country_name": "Pakistan",
    "business:contact_data:locality": "Karachi",
    "business:contact_data:region": "Sindh",
    "business:contact_data:email": "ashir@valtriox.com",
    "business:contact_data:phone_number": "+92-318-3916019",
    "business:contact_data:website": "https://valtriox.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "business",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Phase 7: Read CSP nonce from middleware header for secure inline scripts
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Valtriox" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/*
          SEO: Resource Hints to reduce TTFB and improve Mobile Speed score.
          - preconnect: opens early TLS+DNS+TCP connection to third-party origins
            so the browser can fetch from them instantly when needed.
          - dns-prefetch: legacy fallback for older browsers (resolves DNS only).
          These do NOT add requests — they just warm up connections in parallel
          with HTML parsing, shaving 100-300ms off LCP.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        {/* Meta Pixel - fires fbq('track', 'Lead') on Thank You page */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}>
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            {/* @ts-expect-error suppressHydrationWarning needed for noscript in head */}
            <noscript suppressHydrationWarning>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
        {/* Google Analytics - fires gtag('event', 'generate_lead') on Thank You page */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" nonce={nonce} />
            <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
        {/*
          JSON-LD Structured Data — Organization, WebSite, SoftwareApplication, Person.
          SEO CRITICAL: We render these as raw <script> tags with dangerouslySetInnerHTML
          (NOT next/script <Script> components). The next/script <Script> component
          with strategy="beforeInteractive" pushes the JSON-LD into the RSC stream
          (self.__next_s.push(...)) instead of emitting a real <script type="application/ld+json">
          tag in the initial HTML. As a result, Rank Math and other schema validators
          that don't execute JS reported "No Schema.org data found on the page."
          Raw <script> tags are SSR'd as proper HTML and are immediately parseable
          by every crawler, validator, and search engine.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Valtriox",
              url: "https://valtriox.com",
              logo: "https://valtriox.com/valtriox-logo.png",
              description: SITE_DESCRIPTION,
              foundingDate: "2024",
              founder: {
                "@type": "Person",
                name: "Muhammad Ashir Raza",
                url: FOUNDER_LINKEDIN,
                jobTitle: "Founder & Lead Developer",
                email: BUSINESS_EMAIL,
                nationality: "Pakistani",
                knowsAbout: [
                  "Full-Stack Development",
                  "SaaS Architecture",
                  "Brand Management Software",
                  "Next.js",
                  "TypeScript",
                  "PostgreSQL",
                  "Multi-tenant Systems",
                ],
              },
              email: BUSINESS_EMAIL,
              telephone: BUSINESS_PHONE_TEL,
              address: {
                "@type": "PostalAddress",
                addressLocality: BUSINESS_ADDRESS_LOCALITY,
                addressRegion: BUSINESS_ADDRESS_REGION,
                addressCountry: BUSINESS_ADDRESS_COUNTRY,
              },
              // contactPoint is now an ARRAY (Google recommends multiple
              // contactPoints: one per contact type). Each entry inherits
              // the organization-level telephone/email if not specified.
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "customer support",
                  email: BUSINESS_EMAIL,
                  telephone: BUSINESS_PHONE_TEL,
                  areaServed: ["PK", "Worldwide"],
                  availableLanguage: ["English", "Urdu"],
                  hoursAvailable: BUSINESS_SUPPORT_HOURS,
                },
                {
                  "@type": "ContactPoint",
                  contactType: "sales",
                  email: BUSINESS_EMAIL,
                  telephone: BUSINESS_PHONE_TEL,
                  areaServed: ["PK", "Worldwide"],
                  availableLanguage: ["English", "Urdu"],
                  hoursAvailable: BUSINESS_SUPPORT_HOURS,
                },
              ],
              sameAs: [
                "https://instagram.com/valtriox",
                "https://facebook.com/valtriox",
                "https://twitter.com/valtriox",
                "https://linkedin.com/company/valtriox",
              ],
            }),
          }}
        />
        {/*
          LocalBusiness JSON-LD — the schema Google uses to surface a
          "knowledge panel" / contact card in search results with phone,
          address, hours, and "Call now" / "Get directions" buttons.
          Combined with the Organization schema above, this gives Google
          everything it needs to display Valtriox's contact details when
          users search for "Valtriox contact", "Valtriox phone", etc.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://valtriox.com/#localbusiness",
              name: "Valtriox",
              url: "https://valtriox.com",
              logo: "https://valtriox.com/valtriox-logo.png",
              image: "https://valtriox.com/valtriox-icon-512.png",
              description: SITE_DESCRIPTION,
              email: BUSINESS_EMAIL,
              telephone: BUSINESS_PHONE_TEL,
              priceRange: "$$",
              currenciesAccepted: "PKR, USD",
              paymentAccepted: "Credit Card, Bank Transfer, PayPal, JazzCash, EasyPaisa",
              address: {
                "@type": "PostalAddress",
                addressLocality: BUSINESS_ADDRESS_LOCALITY,
                addressRegion: BUSINESS_ADDRESS_REGION,
                addressCountry: BUSINESS_ADDRESS_COUNTRY,
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 24.8607,
                longitude: 67.0011,
              },
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                  ],
                  opens: "09:00",
                  closes: "18:00",
                },
              ],
              areaServed: [
                { "@type": "Country", name: "Pakistan" },
                { "@type": "Place", name: "Worldwide" },
              ],
              founder: {
                "@type": "Person",
                name: "Muhammad Ashir Raza",
                url: FOUNDER_LINKEDIN,
              },
              sameAs: [
                "https://instagram.com/valtriox",
                "https://facebook.com/valtriox",
                "https://twitter.com/valtriox",
                "https://linkedin.com/company/valtriox",
              ],
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Valtriox Subscription Plans",
                itemListElement: [
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Free 30-minute Strategy Session",
                      description:
                        "Book a free 30-minute strategy session with the Valtriox founder to discuss how to streamline your brand's operations, orders, inventory, and marketing.",
                    },
                    price: "0",
                    priceCurrency: "PKR",
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Valtriox Starter Plan",
                      description:
                        "Brand Dashboard (Basic), 3 marketing channels, standard analytics.",
                    },
                    price: "7999",
                    priceCurrency: "PKR",
                  },
                ],
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Muhammad Ashir Raza",
              url: FOUNDER_LINKEDIN,
              jobTitle: "Founder & Lead Developer at Valtriox",
              email: BUSINESS_EMAIL,
              nationality: "Pakistani",
              worksFor: {
                "@type": "Organization",
                name: "Valtriox",
                url: "https://valtriox.com",
              },
              sameAs: [FOUNDER_LINKEDIN],
              knowsAbout: [
                "Full-Stack Development",
                "SaaS Architecture",
                "Brand Management Software",
                "Next.js",
                "TypeScript",
                "PostgreSQL",
                "Multi-tenant Systems",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Valtriox",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://valtriox.com",
              description: SITE_DESCRIPTION,
              author: {
                "@type": "Person",
                name: "Muhammad Ashir Raza",
                url: FOUNDER_LINKEDIN,
                jobTitle: "Founder & Lead Developer",
              },
              offers: {
                "@type": "Offer",
                price: "7999",
                priceCurrency: "PKR",
                description: "Starter plan: Brand Dashboard (Basic), 3 Marketing Channels, Standard Analytics.",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                reviewCount: "127",
              },
              featureList: [
                "Brand Dashboard",
                "Order Management",
                "Customer Management",
                "Inventory Management",
                "Team Collaboration",
                "Marketing Automation",
                "Analytics & Reports",
                "Multi-channel Integration",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Valtriox",
              url: "https://valtriox.com",
              description: SITE_DESCRIPTION,
              potentialAction: {
                "@type": "SearchAction",
                target: "https://valtriox.com/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ReactQueryProvider>
          <PlatformIdentityProvider>
            {children}
          </PlatformIdentityProvider>
        </ReactQueryProvider>
        <ServiceWorkerRegistrar nonce={nonce} />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
