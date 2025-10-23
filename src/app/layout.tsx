import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import { Analytics } from "@vercel/analytics/next";
import { RadixProvider } from "@/components/providers/radix-provider";

// Initialize security monitoring (server-side only)
if (typeof window === "undefined") {
  import("@/lib/security/auto-start-monitoring").catch(console.error);
} else {
  // Suprimir warnings de hidratação no cliente
  import("@/lib/suppress-hydration-warnings").catch(console.error);
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default:
      "Dog SaaS - Kit Inicial Gratuito para SaaS Moderno | Next.js 15 + TypeScript",
    template: "%s | Dog SaaS - Kit Inicial Gratuito",
  },
  description:
    "Comece seu SaaS gratuitamente com nosso kit inicial completo. Inclui Next.js 15, TypeScript, Stripe, NextAuth.js, PostgreSQL, Docker e muito mais. 100% gratuito e código aberto.",
  keywords: [
    "SaaS gratuito",
    "kit inicial SaaS",
    "Next.js 15",
    "TypeScript",
    "Stripe",
    "NextAuth.js",
    "Tailwind CSS",
    "shadcn/ui",
    "Prisma",
    "PostgreSQL",
    "Docker",
    "template SaaS",
    "código aberto",
    "MIT",
    "começar SaaS",
    "SaaS starter",
    "SaaS template",
    "SaaS gratuito",
    "SaaS open source",
  ],
  authors: [
    {
      name: "Vinicius Matheus",
      url: "https://github.com/vinimatheus",
    },
  ],
  creator: "Vinicius Matheus",
  publisher: "Dog SaaS Team",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    title:
      "Dog SaaS - Kit Inicial Gratuito para SaaS Moderno | Next.js 15 + TypeScript",
    description:
      "Comece seu SaaS gratuitamente com nosso kit inicial completo. Inclui Next.js 15, TypeScript, Stripe, NextAuth.js, PostgreSQL, Docker e muito mais. 100% gratuito e código aberto.",
    siteName: "Dog SaaS - Kit Inicial Gratuito",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dog SaaS - Kit Inicial Gratuito para SaaS Moderno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Dog SaaS - Kit Inicial Gratuito para SaaS Moderno | Next.js 15 + TypeScript",
    description:
      "Comece seu SaaS gratuitamente com nosso kit inicial completo. Inclui Next.js 15, TypeScript, Stripe, NextAuth.js, PostgreSQL, Docker e muito mais. 100% gratuito e código aberto.",
    creator: "@dogsass",
    images: ["/og-image.png"],
  },
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#000000",
      },
    ],
  },
  manifest: "/site.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: "/",
    languages: {
      "pt-BR": "/pt-BR",
    },
  },
  category: "technology",
  classification: "SaaS Starter Kit",
  referrer: "origin-when-cross-origin",
  other: {
    "msapplication-TileColor": "#000000",
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta
          name="google-site-verification"
          content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon-16.png" type="image/png" sizes="16x16" />
        <link
          rel="icon"
          href="/icon-192.png"
          type="image/png"
          sizes="192x192"
        />
        <link
          rel="icon"
          href="/icon-512.png"
          type="image/png"
          sizes="512x512"
        />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
          sizes="180x180"
        />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
      </head>
      <Analytics />
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-screen h-screen`}
      >
        <SessionProvider>
          <RadixProvider>
            <NextTopLoader showSpinner={false} />
            {children}
            <Toaster richColors position="top-right" />
          </RadixProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
