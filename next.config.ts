import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Everything runs in the browser, so build plain static files into out/.
  output: "export",
};

export default nextConfig;
