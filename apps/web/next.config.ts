import type { NextConfig } from "next";

const apiOrigin = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const useApiProxy = process.env.NEXT_PUBLIC_USE_API_PROXY === "true";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!useApiProxy || !apiOrigin) {
      return [];
    }

    const destination = `${apiOrigin.replace(/\/$/, "")}/:path*`;

    return [
      {
        source: "/backend/:path*",
        destination,
      },
    ];
  },
};

export default nextConfig;