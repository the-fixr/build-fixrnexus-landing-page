import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Levy Protocol',
  description: 'Mercenary liquidity protocol on Solana. Post SOL bounties to incentivize LP provision. Non-custodial escrow vaults, time-weighted rewards, transparent on-chain marketplace.',
  openGraph: {
    title: 'Levy Protocol - Mercenary Liquidity on Solana',
    description: 'Post SOL bounties to incentivize liquidity providers. Non-custodial PDA escrow vaults with time-weighted reward distribution.',
    url: '/levy',
    images: [{ url: '/og-levy.png', width: 1200, height: 630, alt: 'Levy Protocol - Mercenary Liquidity' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Levy Protocol - Mercenary Liquidity on Solana',
    description: 'SOL bounties for LP provision. Non-custodial escrow, time-weighted rewards, transparent on-chain marketplace.',
    images: ['/og-levy.png'],
  },
  alternates: {
    canonical: '/levy',
  },
};

export default function LevyLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Levy Protocol',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description: 'Mercenary liquidity protocol on Solana. Post SOL bounties to incentivize LP provision with non-custodial escrow vaults.',
    url: 'https://fixr.nexus/levy',
    creator: {
      '@type': 'Organization',
      name: 'Fixr',
      url: 'https://fixr.nexus',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
