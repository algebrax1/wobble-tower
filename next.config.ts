import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/wobble-tower",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;