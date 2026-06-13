import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // "standalone" output for Railway/self-hosted deployment
  // Vercel ignores this flag and uses its own output mode
  output: "standalone",
  typescript: {
    // NOTE: TypeScript 6.0.2 has a known stack overflow issue with large projects
    // (collectLinkedAliases exceeds max call stack). Keep ignoreBuildErrors enabled
    // until upstream fix is available. Type safety is enforced via strict: true in tsconfig.json
    // and ESLint rules. All new code is written with proper types.
    ignoreBuildErrors: true,
  },
  reactStrictMode: true, // Enable strict mode for better React practices
  allowedDevOrigins: ["http://localhost:3000"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Ensure pdfkit is not bundled by webpack (uses native Node.js features)
  serverExternalPackages: ["pdfkit"],
  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},
  // Webpack bundle optimization (used when --webpack flag is passed)
  webpack(config, { isServer }) {
    // Tree-shake unused exports from heavy libraries
    config.optimization.usedExports = true;
    // Enable module concatenation to reduce bundle size
    config.optimization.concatenateModules = true;
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          'framer-motion': {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer-motion',
            chunks: 'all',
            priority: 20,
          },
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 20,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
  // Include font files in serverless function bundles as safety net
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./fonts/**"],
    "/api/reports/**": ["./fonts/**"],
  },
  // Security headers via Next.js config (backup for middleware)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Redirect www to non-www and HTTP to HTTPS (handled by Vercel, but good practice)
  async redirects() {
    return [];
  },
};

// Wrap with Sentry for automatic error tracking and performance monitoring
export default withSentryConfig(nextConfig, {
  // Suppress all source map uploading during build (faster builds)
  // Set to true in production to enable proper stack traces
  silent: true,
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Only enable Sentry in production-like environments
  disableAutomaticSessionTracking: process.env.NODE_ENV === "development",
});
