'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  icon?: ReactNode;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'pink';
  suffix?: string;
  prefix?: string;
  change?: number;
  loading?: boolean;
}

const colorMap = {
  default: { text: 'text-white', bg: 'bg-gray-800/50', border: 'border-gray-700', icon: 'text-gray-400', glow: '' },
  green: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-400', glow: 'shadow-green-500/10' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: 'text-yellow-400', glow: 'shadow-yellow-500/10' },
  red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400', glow: 'shadow-red-500/10' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400', glow: 'shadow-purple-500/10' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400', glow: 'shadow-blue-500/10' },
  pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: 'text-pink-400', glow: 'shadow-pink-500/10' },
};

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (v) => {
    if (suffix === '%') return `${prefix}${v.toFixed(1)}${suffix}`;
    return `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
  });

  useEffect(() => { spring.set(value); }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

export function StatCard({ label, value, icon, color = 'default', suffix = '', prefix = '', change, loading = false }: StatCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className={`${colors.bg} border ${colors.border} rounded-xl p-5 ${colors.glow} shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className="w-20 h-4 bg-gray-700 rounded animate-pulse" />
          <div className="w-10 h-10 bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="w-24 h-8 bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} className={`${colors.bg} border ${colors.border} rounded-xl p-5 ${colors.glow} shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        {icon && <div className={`p-2 ${colors.bg} rounded-lg border ${colors.border}`}><span className={colors.icon}>{icon}</span></div>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${colors.text}`}><AnimatedNumber value={value} prefix={prefix} suffix={suffix} /></span>
        {change !== undefined && <span className={`text-sm font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{change}%</span>}
      </div>
    </motion.div>
  );
}
