import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["archiverua.toolforge.org"],
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
