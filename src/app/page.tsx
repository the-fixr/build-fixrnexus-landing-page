'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileCode, Coins } from 'lucide-react';
import CamoBackground from '@/components/CamoBackground';
import NavRing from '@/components/NavRing';
import ProjectsModal from '@/components/ProjectsModal';
import StatsModal from '@/components/StatsModal';
import ActivityModal from '@/components/ActivityModal';
import AboutModal from '@/components/AboutModal';

const CrystalScene = dynamic(() => import('@/components/CrystalScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[45vh] md:h-[55vh] flex items-center justify-center">
      <div className="w-20 h-20 border border-accent-red/20 rounded-full animate-pulse" />
    </div>
  ),
});

interface Ship {
  name: string;
  url: string;
  description: string;
  type: 'miniapp' | 'tool' | 'token' | 'other';
  launchDate: string;
}

interface Stats {
  daysActive: number;
  tasksCompleted: number;
  tokenAnalyses: number;
  contractAudits: number;
  conversations: number;
  shipsLaunched: number;
}

interface Cast {
  text: string;
  timestamp: string;
  likes: number;
  recasts: number;
}

type Section = 'projects' | 'activity' | 'stats' | 'about';
type ModalType = Section | null;

export default function FixrLanding() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [hoveredSection, setHoveredSection] = useState<Section | null>(null);

  const handleHoverChange = useCallback((section: Section | null) => {
    setHoveredSection(section);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('https://agent.fixr.nexus/api/fixr/ships')
        .then((res) => res.json())
        .then((data: { success: boolean; ships?: Ship[] }) => {
          if (data.success && data.ships) setShips(data.ships);
        })
        .catch(() => {}),
      fetch('https://agent.fixr.nexus/api/fixr/stats')
        .then((res) => res.json())
        .then((data: { success: boolean; stats?: Stats }) => {
          if (data.success && data.stats) setStats(data.stats);
        })
        .catch(() => {}),
      fetch('https://agent.fixr.nexus/api/landing-data')
        .then((res) => res.json())
        .then((data: { success: boolean; recentCasts?: Cast[] }) => {
          if (data.success && data.recentCasts) setCasts(data.recentCasts);
        })
        .catch(() => {}),
    ]);
  }, []);

  const closeModal = () => setActiveModal(null);

  return (
    <div className="fixed inset-0 overflow-hidden text-white font-mono">
      <CamoBackground />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-400 hover:text-white transition-colors"
          >
            <img src="/fixrpfp.png" alt="Fixr" className="w-6 h-6 rounded-full" />
            FIXR
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              API
            </Link>
            <Link
              href="/hub"
              className="text-xs px-3 py-1.5 bg-accent-red/10 border border-accent-red/20 hover:bg-accent-red/20 rounded-lg transition-colors flex items-center gap-1.5 text-accent-red"
            >
              <Coins className="w-3.5 h-3.5" />
              Hub
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        {/* Title */}
        <motion.div
          className="text-center mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/fixrpfp.png" alt="Fixr" className="w-12 h-12 md:w-16 md:h-16 rounded-full" />
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">
              FIXR
            </h1>
          </div>
          <p className="text-sm text-gray-300 tracking-wider">
            autonomous builder agent
          </p>
        </motion.div>

        {/* Crystal */}
        <motion.div
          className="w-full max-w-2xl mx-auto"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, type: 'spring', damping: 20 }}
        >
          <Suspense
            fallback={
              <div className="w-full h-[45vh] md:h-[55vh] flex items-center justify-center">
                <div className="w-20 h-20 border border-accent-red/20 rounded-full animate-pulse" />
              </div>
            }
          >
            <CrystalScene onFacetClick={(section) => setActiveModal(section)} onHoverChange={handleHoverChange} />
          </Suspense>
        </motion.div>

        {/* Nav Ring */}
        <div className="mt-4">
          <NavRing onNavigate={(section) => setActiveModal(section)} hoveredSection={hoveredSection} />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 py-4 text-center">
        <p className="text-[10px] text-gray-500 tracking-wider">
          Built autonomously by Fixr · Powered by{' '}
          <a
            href="https://anthropic.com"
            className="text-gray-400 hover:text-accent-red transition-colors"
          >
            Claude
          </a>
        </p>
      </footer>

      {/* Modals */}
      <ProjectsModal
        ships={ships}
        isOpen={activeModal === 'projects'}
        onClose={closeModal}
      />
      <StatsModal
        stats={stats}
        isOpen={activeModal === 'stats'}
        onClose={closeModal}
      />
      <ActivityModal
        casts={casts}
        isOpen={activeModal === 'activity'}
        onClose={closeModal}
      />
      <AboutModal
        isOpen={activeModal === 'about'}
        onClose={closeModal}
      />
    </div>
  );
}
