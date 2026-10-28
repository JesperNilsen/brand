import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_TAGLINE } from "@/lib/brand-mark";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeSelect } from "@/components/ThemeSelect";

const description = BRAND_TAGLINE;

export const metadata: Metadata = {
  // Absolute URLs for the OG image and manifest icons are resolved against this;
  // without it a relative URL in `openGraph` is a build error.
  metadataBase: new URL("https://brand-skrift.netlify.app"),
  title: { default: "BRAND", template: "%s · BRAND" },
  description,
  applicationName: "BRAND",
  openGraph: {
    siteName: "BRAND",
    title: "BRAND",
    description,
    locale: "nb_NO",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

/**
 * Applies the stored theme before first paint to avoid a flash. Reads the
 * same localStorage key as LocalStoragePreferences.
 */
const themeScript = `
(function(){try{var p=JSON.parse(localStorage.getItem("brand.preferences")||"null");var t=p&&p.theme;if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <header className="recedes border-b border-rule">
            <div className="relative mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:gap-x-6">
              <Link
                href="/"
                className="flex items-center gap-[0.6em] no-underline hover:text-accent"
                aria-label="BRAND – til forsiden"
              >
                <BrandMark size={22} />
                <span className="wordmark text-lead">BRAND</span>
              </Link>
              <nav className="ml-auto flex items-baseline gap-4 text-sm sm:gap-5">
                <Link href="/historikk" className="no-underline hover:underline">
                  Historikk
                </Link>
                <Link href="/om" className="no-underline hover:underline">
                  Om
                </Link>
                <LanguageMenu />
                <ThemeSelect />
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
            {children}
          </main>
          <footer className="recedes mx-auto w-full max-w-4xl px-5 py-6 text-sm text-ink-muted">
            Lokal lagring i nettleseren. Ingen konto, ingen sky.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
