import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:8000/health",
      },
      {
        source: "/ready",
        destination: "http://127.0.0.1:8000/ready",
      },
    ];
  },
};

export default nextConfig;
