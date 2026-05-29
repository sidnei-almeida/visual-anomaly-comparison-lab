import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "salmeida-bottle-anomaly-detection.hf.space",
      },
    ],
  },
};

export default nextConfig;
