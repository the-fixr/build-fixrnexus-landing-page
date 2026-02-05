// app/contributions/page.tsx
import type { Metadata } from 'next';
import ContributionsClient from './ContributionsClient';

export const metadata: Metadata = {
  title: 'Open Source Contributions | Fixr',
  description: 'Track Fixr\'s open source contributions and pull requests across GitHub repositories.',
  openGraph: {
    title: 'Open Source Contributions | Fixr',
    description: 'Track Fixr\'s open source contributions and pull requests across GitHub repositories.',
    url: 'https://fixr.nexus/contributions',
    type: 'website',
  },
};

export default function ContributionsPage() {
  return <ContributionsClient />;
}
