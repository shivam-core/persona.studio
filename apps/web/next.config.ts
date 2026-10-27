import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Only rewrite to local backend during development when running locally.
// On cloud providers (e.g. Vercel), do not attempt rewriting to private IP 127.0.0.1.
const backendUrl = process.env.API_INTERNAL_URL || (isDev ? "http://127.0.0.1:8000" : null);

const nextConfig: NextConfig = {
  async rewrites() {
    if (backendUrl) {
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: "/health",
          destination: `${backendUrl}/health`,
        },
        {
          source: "/ready",
          destination: `${backendUrl}/ready`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
