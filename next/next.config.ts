import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /* config options here */

  async rewrites() {
    if (isDev) {
      return [
        {
          source: "/api/:path*",
          destination: "http://host.docker.internal:8000/api/:path*/",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
