import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan akses dari IP lokal / LAN dan localhost
  allowedDevOrigins: [
    "192.168.1.47",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.1.*",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
