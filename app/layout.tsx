import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WagmiProviders } from "@/lib/wagmi/WagmiProviders";

export const dynamic = 'force-dynamic';

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FEEDS - Decentralized Oracle Network",
  description: "Create custom data oracles on Base with AI-powered consensus verification",
  icons: {
    icon: '/feedslogotransparent.png',
    apple: '/feedslogotransparent.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jetbrainsMono.variable} font-mono antialiased`}
      >
        <WagmiProviders>
          {children}
        </WagmiProviders>
      </body>
    </html>
  );
}
