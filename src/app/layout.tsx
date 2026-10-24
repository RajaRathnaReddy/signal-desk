import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./admin.css";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { organizationJsonLd, siteUrl, ldString } from "@/lib/seo";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"], weight: ["400", "500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s — ${SITE_NAME}` },
  description: "Independent technology reporting and analysis across AI, security, cloud, hardware, developer tools and the wider industry. Every story is verified and sourced.",
  applicationName: SITE_NAME,
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#faf8f4" }, { media: "(prefers-color-scheme: dark)", color: "#0e0e10" }],
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint so the chosen theme never flashes.
const themeInit = `try{var t=localStorage.getItem('sd-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldString(organizationJsonLd()) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
