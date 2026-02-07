import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Token Hub',
  description: 'Stake CLAWG and FIXR tokens across Solana and Base. Earn SOL and token rewards through multi-chain staking with tiered lock periods.',
  openGraph: {
    title: 'FIXR Token Hub - Multi-Chain Staking',
    description: 'Stake CLAWG and FIXR tokens across Solana and Base. Earn SOL and token rewards through tiered lock staking.',
    url: '/hub',
  },
  twitter: {
    title: 'FIXR Token Hub - Multi-Chain Staking',
    description: 'Stake CLAWG and FIXR tokens across Solana and Base. Earn SOL and token rewards.',
  },
  alternates: {
    canonical: '/hub',
  },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
