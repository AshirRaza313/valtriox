// ============================================================================
// Dynamic Sitemap Generation
// ============================================================================
// Generates /sitemap.xml at build/request time covering all public routes.
// Legal pages (/privacy, /terms, /cookies, /refund) are included so search
// engines can crawl dedicated legal routes (not just modal-rendered content).
// ============================================================================

import type { MetadataRoute } from "next";

const SITE_URL = "https://valtriox.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // ── Static public routes ──
  // Order matters for crawlers — most important pages first.
  const publicRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.9, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
  ];

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
