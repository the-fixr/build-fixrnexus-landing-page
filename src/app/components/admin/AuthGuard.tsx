'use client';

import { ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

// Authorized wallet addresses (lowercase for comparison)
const AUTHORIZED_WALLETS = [
  '0xbe2cc1861341f3b058a3307385beba84167b3fa4', // Chad's wallet
];

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { address, isConnecting, isConnected } = useAccount();

  const isAuthorized = address
    ? AUTHORIZED_WALLETS.includes(address.toLowerCase())
    : false;

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not connected or not authorized
  if (!isConnected || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 text-center">
            {/* Logo */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-1">
                <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center">
                  <ShieldExclamationIcon className="w-10 h-10 text-purple-400" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Fixr Admin</h1>
            <p className="text-gray-400 text-sm mb-8">
              Connect your wallet to access the admin portal. Only authorized wallets can access this area.
            </p>

            {isConnected && !isAuthorized && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <p className="text-red-400 text-sm mb-2">This wallet is not authorized</p>
                <p className="text-xs text-gray-500 font-mono truncate">{address}</p>
              </motion.div>
            )}

            <div className="flex justify-center">
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus={{
                  smallScreen: 'avatar',
                  largeScreen: 'full',
                }}
              />
            </div>

            <p className="text-xs text-gray-600 mt-6">
              Supports MetaMask, Coinbase Wallet, WalletConnect & more
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authorized - render children
  return <>{children}</>;
}
