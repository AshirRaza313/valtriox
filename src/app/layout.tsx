import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import Script from "next/script";
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

export const metadata: Metadata = {
  title: "Valtriox | COMMEND YOUR BRAND UNIVERSE",
  description: "The universal brand management portal for modern businesses. Command every aspect of your brand from a single, powerful platform",

  keywords: ["Valtriox", "brand management", "universal brand management portal", "order management", "inventory", "team collaboration", "business operations", "SaaS"],
  authors: [{ name: "Valtriox" }],
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
    title: "Valtriox | COMMEND YOUR BRAND UNIVERSE",
    description: "The universal brand management portal for modern businesses. Command every aspect of your brand from a single, powerful platform",
    type: "website",
    url: "https://valtriox.com",
    siteName: "Valtriox",
    images: [
      {
        url: "/valtriox-icon-512.png",
        width: 512,
        height: 512,
        alt: "COMMEND YOUR BRAND UNIVERSE",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            <Script id="meta-pixel" strategy="afterInteractive">
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
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
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
        <ServiceWorkerRegistrar />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
