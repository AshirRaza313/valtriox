"use client";

// ============================================================================
// Meta Pixel (Facebook Pixel) — Next.js App Router
// ============================================================================
// - Loads afterInteractive so it never blocks first paint
// - Fires PageView on initial load + every client-side route change
// - Reads Pixel ID from NEXT_PUBLIC_META_PIXEL_ID (never hardcoded)
// - Respects CSP: middleware already allows connect.facebook.net
// ============================================================================

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  const pathname = usePathname();
  const isFirstLoad = useRef(true);
  const pixelInitialized = useRef(false);

  // Fire PageView on every route change (skip the very first one —
  // the inline snippet already fired it during init)
  useEffect(() => {
    if (!PIXEL_ID) return;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname]);

  // No Pixel ID configured → render nothing (safe for dev / preview)
  if (!PIXEL_ID) {
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
            window.__metaPixelInitialized = true;
          `,
        }}
        onLoad={() => {
          pixelInitialized.current = true;
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}