'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AdminCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerAction?: ReactNode;
  noPadding?: boolean;
}

export function AdminCard({
  children,
  title,
  subtitle,
  className = '',
  headerAction,
  noPadding = false,
}: AdminCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.2 }}
      className={`bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors ${className}`}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </motion.div>
  );
}
