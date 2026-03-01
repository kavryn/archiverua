import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["wikiarchiver.toolforge.org"],
      bodySizeLimit: "50mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  sourcemaps: {
    disable: true,
  },
  silent: true,
});
