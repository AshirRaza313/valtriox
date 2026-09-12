"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CONSENT_KEY = "cookie-consent";
const CONSENT_VALUE = "accepted";

export default function MetaPixel() {
  const pathname = usePathname();
  const isFirstLoad = useRef(true);
  const [hasConsent, setHasConsent] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Check consent on mount + listen for changes
  useEffect(() => {
    setIsHydrated(true);
    try {
      if (localStorage.getItem(CONSENT_KEY) === CONSENT_VALUE) {
        setHasConsent(true);
      }
    } catch {
      // localStorage unavailable
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY && e.newValue === CONSENT_VALUE) {
        setHasConsent(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fire PageView on route changes (skip initial — inline snippet does it)
  useEffect(() => {
    if (!hasConsent || !PIXEL_ID) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname, hasConsent]);

  // No render until hydrated + consented + pixel ID present
  if (!isHydrated || !hasConsent || !PIXEL_ID) return null;

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
          `,
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