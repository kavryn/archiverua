import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["archiverua.toolforge.org"],
    },
  },
};

export default nextConfig;
