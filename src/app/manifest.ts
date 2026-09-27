import type { MetadataRoute } from "next";
import { BRAND_TAGLINE } from "@/lib/brand-mark";

/**
 * Enough for «Legg til på Hjem-skjerm» to give BRAND its own name, icon and
 * paper-coloured splash. Not an offline app: there is no service worker, and
 * the texts are fetched on demand. Icons come from `pnpm build:icons`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BRAND",
    short_name: "BRAND",
    description: BRAND_TAGLINE,
    lang: "nb",
    start_url: "/",
    display: "minimal-ui",
    background_color: "#f7f3ec",
    theme_color: "#f7f3ec",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
