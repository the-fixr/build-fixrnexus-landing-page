import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fixr Admin',
  description: 'Control center for the Fixr autonomous builder agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
