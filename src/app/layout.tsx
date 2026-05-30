import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

const siteDescription =
  "Bottle anomaly inspection demo — denoising conv autoencoder reconstruction, heatmap, mask, and client-drawn regions on MVTec AD bottle samples.";

const siteUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL != null
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : "https://visual-anomaly-comparison-lab.vercel.app";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bottle Anomaly Inspection — Comparison Lab",
  description: siteDescription,
  applicationName: "Comparison Lab",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Comparison Lab",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Comparison Lab — Bottle Anomaly Inspection",
    description: siteDescription,
    siteName: "Comparison Lab",
    type: "website",
    url: siteUrl,
    images: [{ url: "/icon.svg", width: 24, height: 24, alt: "Comparison Lab" }],
  },
  twitter: {
    card: "summary",
    title: "Comparison Lab — Bottle Anomaly Inspection",
    description: siteDescription,
    images: ["/icon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} min-h-screen bg-lab-bg text-lab-text antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
