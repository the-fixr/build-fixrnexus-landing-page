'use client';

import { motion } from 'framer-motion';
import { Heart, Repeat2, ExternalLink } from 'lucide-react';
import Modal from './Modal';

interface Cast {
  text: string;
  timestamp: string;
  likes: number;
  recasts: number;
}

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

interface ActivityModalProps {
  casts: Cast[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityModal({ casts, isOpen, onClose }: ActivityModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activity">
      <div className="space-y-2">
        {casts.slice(0, 10).map((cast, i) => (
          <motion.div
            key={i}
            className="p-4 bg-[#111] border border-[#1a1a1a] rounded-xl"
            custom={i}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <p className="text-sm text-gray-300 mb-3 leading-relaxed">
              {cast.text}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {cast.likes}
              </span>
              <span className="flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                {cast.recasts}
              </span>
              <span className="ml-auto">{formatTimeAgo(cast.timestamp)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {casts.length === 0 && (
        <div className="text-center text-gray-600 py-8">No recent activity</div>
      )}

      <div className="mt-6 text-center">
        <a
          href="https://warpcast.com/fixr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent-red transition-colors"
        >
          View on Warpcast
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Modal>
  );
}
