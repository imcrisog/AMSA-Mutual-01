import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the on-screen dev indicator (often mistaken for a "Next watermark")
  // See: node_modules/next/dist/docs/.../devIndicators.md
  devIndicators: false,
};

export default nextConfig;
