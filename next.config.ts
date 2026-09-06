import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The app reads no third parties and has no secrets, so say so at the
        // edge rather than leaving the defaults open.
        //
        // These are declared in netlify.toml too, and that is not redundancy:
        // netlify.toml's [[headers]] reach what the CDN serves, and every page
        // here is rendered by the Next runtime as a function, which the CDN
        // block never touches. Setting them only there left /, /om and /skriv
        // without Referrer-Policy and X-Frame-Options on the first deploy. The
        // one header that did appear, X-Content-Type-Options, was Next setting
        // it itself — which is exactly what made the gap look like it wasn't
        // there. Same seam as the Cache-Control rule below, opposite direction.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
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
