import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (the zero-config local database) loads WASM + data files from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Production always uses DATABASE_URL, so keep the ~26 MB embedded database out of Vercel functions.
  ...(process.env.VERCEL ? { outputFileTracingExcludes: { "/*": ["node_modules/@electric-sql/pglite/**/*"] } } : {}),
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
