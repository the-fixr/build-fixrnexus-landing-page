import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Levy Protocol',
  description: 'Privacy Policy for the Levy Protocol. We do not collect, store, or process personal information.',
  alternates: { canonical: '/levy/privacy' },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
