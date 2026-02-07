import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use - Levy Protocol',
  description: 'Terms of Use for the Levy Protocol, a non-custodial liquidity bounty protocol on Solana.',
  alternates: { canonical: '/levy/terms' },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
