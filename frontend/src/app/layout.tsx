import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://flashread.app";
const SITE_NAME = "FlashRead";
const SITE_DESCRIPTION =
  "Open-source speed reading tool that reformats dense academic text into clearer layouts using RSVP, research-backed typography, and PDF OCR.";

export const metadata: Metadata = {
  // ── Core ──────────────────────────────────────────────
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – Speed Read Research Papers & PDFs`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "speed reading",
    "RSVP",
    "rapid serial visual presentation",
    "research papers",
    "PDF reader",
    "OCR",
    "academic reading",
    "typography optimization",
    "reading tool",
    "open source",
    "FlashRead",
  ],
  authors: [{ name: "boncui", url: "https://github.com/boncui" }],
  creator: "boncui",

  // ── Open Graph ────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Speed Read Research Papers & PDFs`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "FlashRead – Speed Read Research Papers",
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} – Speed Read Research Papers & PDFs`,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },

  // ── Robots / Indexing ─────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Icons ─────────────────────────────────────────────
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  // ── Alternates ────────────────────────────────────────
  alternates: {
    canonical: SITE_URL,
  },

  // ── Other / LLM hints ────────────────────────────────
  other: {
    "llms.txt": `${SITE_URL}/llms.txt`,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// ── JSON-LD structured data ──────────────────────────────
function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "RSVP speed reading",
      "PDF OCR text extraction",
      "Research-backed typography optimization",
      "Cadence-modeled word pacing",
      "Synced text panel",
      "Adjustable WPM controls",
    ],
    sourceOrganization: {
      "@type": "Organization",
      name: "FlashRead",
      url: "https://github.com/boncui/FlashRead",
    },
    isAccessibleForFree: true,
    license: "https://github.com/boncui/FlashRead/blob/main/LICENSE",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <JsonLd />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
