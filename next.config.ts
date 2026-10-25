import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@mediapipe/tasks-vision"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    ignoreIssue: [
      {
        path: "**/node_modules/@mediapipe/tasks-vision/**",
        title: /Module not found/,
      },
    ],
  },
};

export default nextConfig;
