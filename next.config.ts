import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vinext/Next defaults multipart server requests to 1MB, which rejects
    // ordinary phone photos before the album route can store them in R2.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
