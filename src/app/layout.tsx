import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeSelect } from "@/components/ThemeSelect";

export const metadata: Metadata = {
  title: "BRAND",
  description: "Skriv deg inn i god norsk prosa — med ro, rytme og målbar fremgang.",
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
          <header className="border-b border-rule">
            <div className="mx-auto flex w-full max-w-4xl items-baseline justify-between gap-6 px-5 py-4">
              <Link
                href="/"
                className="text-lg tracking-[0.18em] no-underline hover:text-accent"
                aria-label="BRAND – til forsiden"
              >
                BRAND
              </Link>
              <nav className="flex items-baseline gap-5 text-sm">
                <Link href="/historikk" className="no-underline hover:underline">
                  Historikk
                </Link>
                <Link href="/om" className="no-underline hover:underline">
                  Om
                </Link>
                <ThemeSelect />
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-4xl px-5 py-6 text-xs text-ink-faint">
            Lokal lagring i nettleseren. Ingen konto, ingen sky.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
