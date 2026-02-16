import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE || "false",
  },
};

export default nextConfig;
