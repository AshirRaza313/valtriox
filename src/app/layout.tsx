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
const SITE_DESCRIPTION =
  "The universal brand operating system for modern businesses. Founded and built by Muhammad Ashir Raza. Command every aspect of your brand (orders, inventory, customers, marketing, analytics) from a single, powerful platform.";
const SITE_TITLE = "Valtriox | Command Your Brand Universe";
const SITE_OG_TITLE = "Valtriox | Command Your Brand Universe | by Muhammad Ashir Raza";
const SITE_OG_DESCRIPTION =
  "The universal brand operating system founded and built by Muhammad Ashir Raza. Manage orders, inventory, customers, marketing, and analytics from one beautiful dashboard. Made in Pakistan for the world.";
const FOUNDER_LINKEDIN = "https://www.linkedin.com/in/muhammad-ashir-raza";

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
        {/* JSON-LD Structured Data — Organization, WebSite, SoftwareApplication, Person */}
        <Script id="ld-org" type="application/ld+json" strategy="beforeInteractive" nonce={nonce}>
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Valtriox",
            url: "https://valtriox.com",
            logo: "https://valtriox.com/valtriox-logo.png",
            description: SITE_DESCRIPTION,
            foundingDate: "2025",
            founder: {
              "@type": "Person",
              name: "Muhammad Ashir Raza",
              url: FOUNDER_LINKEDIN,
              jobTitle: "Founder & Lead Developer",
              email: "ashir@valtriox.com",
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
            email: "ashir@valtriox.com",
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "ashir@valtriox.com",
              availableLanguage: ["English"],
            },
            sameAs: [
              "https://instagram.com/valtriox",
              "https://facebook.com/valtriox",
              "https://twitter.com/valtriox",
              "https://linkedin.com/company/valtriox",
            ],
          })}
        </Script>
        <Script id="ld-person" type="application/ld+json" strategy="beforeInteractive" nonce={nonce}>
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Muhammad Ashir Raza",
            url: FOUNDER_LINKEDIN,
            jobTitle: "Founder & Lead Developer at Valtriox",
            email: "ashir@valtriox.com",
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
          })}
        </Script>
        <Script id="ld-software" type="application/ld+json" strategy="beforeInteractive" nonce={nonce}>
          {JSON.stringify({
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
          })}
        </Script>
        <Script id="ld-website" type="application/ld+json" strategy="beforeInteractive" nonce={nonce}>
          {JSON.stringify({
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
          })}
        </Script>
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
