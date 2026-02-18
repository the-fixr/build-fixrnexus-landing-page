'use client';

import { motion } from 'framer-motion';
import {
  ExternalLink,
  Smartphone,
  Wrench,
  Coins,
  Sparkles,
} from 'lucide-react';
import Modal from './Modal';

interface Ship {
  name: string;
  url: string;
  description: string;
  type: 'miniapp' | 'tool' | 'token' | 'other';
  launchDate: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  miniapp: Smartphone,
  tool: Wrench,
  token: Coins,
  other: Sparkles,
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
};

interface ProjectsModalProps {
  ships: Ship[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectsModal({ ships, isOpen, onClose }: ProjectsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Projects">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ships.map((ship, i) => {
          const TypeIcon = TYPE_ICONS[ship.type] || Sparkles;
          return (
            <motion.a
              key={ship.name}
              href={ship.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 p-4 bg-[#111] border border-[#1a1a1a] rounded-xl hover:border-accent-red/40 transition-colors"
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-accent-red/20 to-accent-red/5 rounded-lg flex items-center justify-center shrink-0">
                <TypeIcon className="w-5 h-5 text-accent-red" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    {ship.type}
                  </span>
                </div>
                <h3 className="font-semibold text-sm group-hover:text-accent-red transition-colors">
                  {ship.name}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                  {ship.description}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-700 group-hover:text-accent-red transition-colors shrink-0 mt-1" />
            </motion.a>
          );
        })}
      </div>
      {ships.length === 0 && (
        <div className="text-center text-gray-600 py-8">Loading projects...</div>
      )}
    </Modal>
  );
}
