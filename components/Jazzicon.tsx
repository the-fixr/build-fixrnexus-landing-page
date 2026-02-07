'use client';

import { useEffect, useRef, useState } from 'react';

interface JazziconProps {
  address: string;
  diameter?: number;
  className?: string;
}

export default function Jazzicon({ address, diameter = 24, className = '' }: JazziconProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only run on client-side
    if (!mounted || !iconRef.current || !address || typeof window === 'undefined') return;

    // Dynamically import jazzicon to avoid SSR issues
    import('@metamask/jazzicon').then((jazziconModule) => {
      const jazzicon = jazziconModule.default;

      if (!iconRef.current) return;

      // Clear any existing icon
      iconRef.current.innerHTML = '';

      // Generate seed from address
      const seed = parseInt(address.slice(2, 10), 16);

      // Generate and append jazzicon
      const icon = jazzicon(diameter, seed);
      iconRef.current.appendChild(icon);
    });

    return () => {
      if (iconRef.current) {
        iconRef.current.innerHTML = '';
      }
    };
  }, [address, diameter, mounted]);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <div
        className={className}
        style={{
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          background: 'rgba(128, 128, 128, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />
    );
  }

  return <div ref={iconRef} className={className} style={{ display: 'flex', alignItems: 'center' }} />;
}
