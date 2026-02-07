import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer - Levy Protocol',
  description: 'Disclaimer for the Levy Protocol. Experimental software on Solana — use at your own risk.',
  alternates: { canonical: '/levy/disclaimer' },
};

export default function DisclaimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
