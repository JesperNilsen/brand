import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Edition texts are named after their own contentHash: a text that
        // changes gets a new filename, so a cached copy can never be the wrong
        // text. Cache it for a year.
        source: "/content/editions/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
