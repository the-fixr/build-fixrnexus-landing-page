'use client';

import { motion } from 'framer-motion';
import {
  Rocket,
  MessageCircle,
  BarChart3,
  Zap,
  Github,
  Send,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

type Section = 'projects' | 'activity' | 'stats' | 'about';

interface NavRingProps {
  onNavigate: (section: Section) => void;
  hoveredSection: Section | null;
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'projects', label: 'Projects', icon: Rocket },
  { id: 'activity', label: 'Activity', icon: MessageCircle },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'about', label: 'About', icon: Zap },
];

const SOCIALS = [
  { name: 'Farcaster', url: 'https://warpcast.com/fixr', icon: MessageCircle },
  { name: 'X', url: 'https://x.com/Fixr21718', icon: () => <span className="font-bold text-[10px] leading-none">𝕏</span> },
  { name: 'GitHub', url: 'https://github.com/the-fixr', icon: Github },
  { name: 'Moltbook', url: 'https://moltbook.com/agent/the-fixr', icon: BookOpen },
  { name: 'Discord', url: 'https://discord.com/users/1468759272631435469', icon: MessageSquare },
  { name: 'Telegram', url: 'https://t.me/the_fixr', icon: Send },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.6 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function NavRing({ onNavigate, hoveredSection }: NavRingProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Nav links */}
      <div className="grid grid-cols-4 w-full max-w-md">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isLit = hoveredSection === item.id;
          return (
            <motion.button
              key={item.id}
              variants={itemVariants}
              onClick={() => onNavigate(item.id)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer justify-self-center"
            >
              <Icon
                className={`w-5 h-5 transition-colors duration-300 ${
                  isLit ? 'text-accent-red' : 'text-gray-400 group-hover:text-accent-red'
                }`}
              />
              <span
                className={`text-[11px] uppercase tracking-[0.2em] transition-all duration-300 overflow-hidden ${
                  isLit
                    ? 'max-h-6 opacity-100 text-white'
                    : 'max-h-0 opacity-0 group-hover:max-h-6 group-hover:opacity-100 text-gray-300 group-hover:text-white'
                }`}
              >
                {item.label}
              </span>
              <div
                className={`h-px bg-accent-red transition-all duration-300 ${
                  isLit ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Social icons */}
      <motion.div
        className="flex items-center gap-3"
        variants={itemVariants}
      >
        {SOCIALS.map((social) => {
          const Icon = social.icon;
          return (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              title={social.name}
              className="p-2 text-gray-400 hover:text-accent-red transition-colors duration-300"
            >
              <Icon className="w-3.5 h-3.5" />
            </a>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
