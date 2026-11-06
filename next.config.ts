import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only badge: keep it off the sidebar footer.
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
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
