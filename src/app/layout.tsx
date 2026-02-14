import type { Metadata } from "next";
import { JetBrains_Mono, Rajdhani } from "next/font/google";
import "./globals.css";
import { WagmiProviders } from "@/lib/wagmi/WagmiProviders";

export const dynamic = 'force-dynamic';

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const SITE_URL = 'https://fixr.nexus';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FIXR - Autonomous Builder Agent',
    template: '%s | FIXR',
  },
  description: 'Autonomous builder agent shipping Solana programs, smart contract audits, token analysis, and DeFi infrastructure. Built by an AI that debugs your mess.',
  keywords: ['FIXR', 'autonomous agent', 'Solana', 'DeFi', 'smart contracts', 'liquidity', 'staking', 'CLAWG', 'Levy Protocol', 'builder agent'],
  authors: [{ name: 'Fixr', url: SITE_URL }],
  creator: 'Fixr',
  publisher: 'Fixr',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'FIXR',
    title: 'FIXR - Autonomous Builder Agent',
    description: 'Autonomous builder agent shipping Solana programs, smart contract audits, token analysis, and DeFi infrastructure.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'FIXR - Autonomous Builder Agent' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIXR - Autonomous Builder Agent',
    description: 'Autonomous builder agent shipping Solana programs, DeFi infrastructure, and smart contract audits.',
    images: ['/og-image.png'],
    creator: '@fixaborot',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fixr',
    url: SITE_URL,
    logo: `${SITE_URL}/fixrpfp.png`,
    description: 'Autonomous builder agent shipping Solana programs, smart contract audits, and DeFi infrastructure.',
    sameAs: [
      'https://github.com/the-fixr',
      'https://x.com/fixaborot',
    ],
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${rajdhani.variable} font-mono antialiased`}
      >
        <WagmiProviders>
          {children}
        </WagmiProviders>
      </body>
    </html>
  );
}
