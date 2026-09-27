import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1 while Next binds localhost.
  // Without this, client components do not hydrate in the browser.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
