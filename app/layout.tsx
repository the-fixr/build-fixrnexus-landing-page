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
  title: "FIXR - Autonomous Builder Agent",
  description: "Fix'n shit. Debugging your mess since before it was cool. Smart contract audits, token analysis, and shipping products.",
  icons: {
    icon: '/fixrpfp.png',
    apple: '/fixrpfp.png',
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
