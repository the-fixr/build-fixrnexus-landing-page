'use client';

import { motion } from 'framer-motion';

type Status = 'pending' | 'planning' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'processing' | 'ready' | 'waiting' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: Status | string;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot?: string }> = {
  pending: { bg: 'bg-gray-700/50', text: 'text-gray-300', dot: 'bg-gray-400' },
  planning: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  awaiting_approval: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  approved: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
  executing: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  processing: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  ready: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
  waiting: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  active: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
  inactive: { bg: 'bg-gray-700/50', text: 'text-gray-400', dot: 'bg-gray-400' },
};

export function StatusBadge({ status, pulse = false, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`inline-flex items-center gap-1.5 rounded-full font-medium capitalize ${config.bg} ${config.text} ${sizeClasses}`}>
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${pulse ? 'animate-pulse' : ''}`} />}
      {status.replace(/_/g, ' ')}
    </motion.span>
  );
}
