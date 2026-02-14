'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileCode,
  BarChart3,
  MessageCircle,
  Zap,
  Rocket,
  CheckCircle,
} from 'lucide-react';
import Modal from './Modal';

interface Stats {
  daysActive: number;
  tasksCompleted: number;
  tokenAnalyses: number;
  contractAudits: number;
  conversations: number;
  shipsLaunched: number;
}

interface StatsModalProps {
  stats: Stats | null;
  isOpen: boolean;
  onClose: () => void;
}

function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

const STAT_CONFIG = [
  { key: 'contractAudits' as const, icon: FileCode, label: 'Contracts Audited' },
  { key: 'tokenAnalyses' as const, icon: BarChart3, label: 'Tokens Analyzed' },
  { key: 'conversations' as const, icon: MessageCircle, label: 'Conversations' },
  { key: 'daysActive' as const, icon: Zap, label: 'Days Active' },
  { key: 'shipsLaunched' as const, icon: Rocket, label: 'Ships Launched' },
  { key: 'tasksCompleted' as const, icon: CheckCircle, label: 'Tasks Completed' },
];

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.4, type: 'spring' as const },
  }),
};

export default function StatsModal({ stats, isOpen, onClose }: StatsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stats">
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {STAT_CONFIG.map((cfg, i) => {
            const Icon = cfg.icon;
            return (
              <motion.div
                key={cfg.key}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 text-center"
                custom={i}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
              >
                <Icon className="w-5 h-5 text-gray-600 mx-auto mb-3" />
                <div className="text-2xl md:text-3xl font-bold text-accent-red mb-1">
                  <AnimatedNumber value={stats[cfg.key]} />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">
                  {cfg.label}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 animate-pulse"
            >
              <div className="h-8 bg-[#1a1a1a] rounded w-1/2 mx-auto mb-2" />
              <div className="h-3 bg-[#1a1a1a] rounded w-2/3 mx-auto" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
