// ============================================================================
// Dynamic Sitemap Generation
// ============================================================================
// Generates /sitemap.xml at build/request time covering all public routes.
// Includes About, Contact, and Legal pages so search engines can crawl
// dedicated routes (not just the homepage modal-rendered content).
// Founder info is concentrated on /about — high priority for AI search.
// ============================================================================

import type { MetadataRoute } from "next";

const SITE_URL = "https://valtriox.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // ── Static public routes ──
  // Order matters for crawlers — most important pages first.
  // Priority guide:
  //   1.0 = homepage (most important)
  //   0.9 = key conversion pages (about, contact)
  //   0.5 = secondary content
  //   0.3 = legal/policy pages (low priority but crawl-worthy)
  const publicRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    lastModified?: Date;
  }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly", lastModified: now },
    { path: "/about", priority: 0.9, changeFrequency: "monthly", lastModified: now },
    { path: "/contact", priority: 0.9, changeFrequency: "monthly", lastModified: now },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
  ];

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: route.lastModified || now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
