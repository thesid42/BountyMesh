import type { NextConfig } from "next";

if (process.env.__BOUNTYMESH_LOOPBACK_BOUND === undefined) {
  process.env.__BOUNTYMESH_LOOPBACK_BOUND = "1";
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["stripe"],
};

export default nextConfig;
