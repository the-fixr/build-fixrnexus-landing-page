'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  WalletIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { AuthGuard } from '@/components/admin';

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Tasks', href: '/admin/tasks', icon: ClipboardDocumentListIcon },
  { name: 'Social', href: '/admin/social', icon: ChatBubbleLeftRightIcon },
  { name: 'Video', href: '/admin/video', icon: VideoCameraIcon },
  { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
  { name: 'Builders', href: '/admin/builders', icon: UserGroupIcon },
  { name: 'Config', href: '/admin/config', icon: Cog6ToothIcon },
  { name: 'Wallet', href: '/admin/wallet', icon: WalletIcon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading admin...</div>
      </div>
    );
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
          },
        }}
      />

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-900/95 backdrop-blur-md border-r border-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full blur-md opacity-40" />
              <img
                src="/images/fixrpfp.png"
                alt="Fixr"
                className="relative w-10 h-10 rounded-full border border-purple-500/50"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Fixr Admin
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Control Center</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-purple-400' : ''
                  }`}
                />
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="ml-auto w-2 h-2 rounded-full bg-purple-400"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            <span className="font-medium">Exit Admin</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-gray-500">Admin</span>
              <span className="text-gray-600">/</span>
              <span className="text-white capitalize">
                {pathname === '/admin'
                  ? 'Dashboard'
                  : pathname?.split('/').pop()?.replace('-', ' ')}
              </span>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Agent Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </AuthGuard>
  );
}
