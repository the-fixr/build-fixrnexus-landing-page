'use client';

import { useState } from 'react';
import { X, Check, Mail, Lock, Wallet, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface SignupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'email' | 'verify' | 'wallet' | 'complete';

export default function SignupWizard({ isOpen, onClose }: SignupWizardProps) {
  const [step, setStep] = useState<WizardStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  // Wagmi hooks for wallet connection
  const { isConnected, address } = useAccount();

  if (!isOpen) return null;

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signupError) throw signupError;

      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  // Check if wallet is already connected
  const handleWalletConnected = () => {
    if (isConnected && address) {
      setStep('complete');
    }
  };

  const skipWalletConnection = () => {
    setStep('complete');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-gray-800 max-w-md w-full mx-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Progress Steps */}
        <div className="border-b border-gray-800 p-6">
          <h2 className="text-xl font-bold mb-4">GET STARTED WITH FEEDS</h2>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${
                  step === 'email' || step === 'verify' || step === 'wallet' || step === 'complete'
                    ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)]'
                    : 'border-gray-700'
                }`}
              >
                {(step === 'verify' || step === 'wallet' || step === 'complete') ? (
                  <Check size={16} className="text-black" />
                ) : (
                  <Mail size={16} className="text-black" />
                )}
              </div>
              <span className="text-xs text-gray-500">Email</span>
            </div>

            <div className="flex-1 h-[2px] bg-gray-800" style={{ marginTop: '-20px' }}>
              <div
                className={`h-full transition-all duration-300 ${
                  step === 'verify' || step === 'wallet' || step === 'complete'
                    ? 'bg-[rgb(255,0,110)]'
                    : 'bg-gray-800'
                }`}
                style={{ width: step === 'verify' || step === 'wallet' || step === 'complete' ? '100%' : '0%' }}
              />
            </div>

            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${
                  step === 'wallet' || step === 'complete'
                    ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)]'
                    : 'border-gray-700'
                }`}
              >
                {step === 'complete' ? (
                  <Check size={16} className="text-black" />
                ) : (
                  <Wallet size={16} className={step === 'wallet' ? 'text-black' : 'text-gray-700'} />
                )}
              </div>
              <span className="text-xs text-gray-500">Wallet</span>
            </div>

            <div className="flex-1 h-[2px] bg-gray-800" style={{ marginTop: '-20px' }}>
              <div
                className={`h-full transition-all duration-300 ${
                  step === 'complete' ? 'bg-[rgb(255,0,110)]' : 'bg-gray-800'
                }`}
                style={{ width: step === 'complete' ? '100%' : '0%' }}
              />
            </div>

            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${
                  step === 'complete'
                    ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)]'
                    : 'border-gray-700'
                }`}
              >
                <Zap size={16} className={step === 'complete' ? 'text-black' : 'text-gray-700'} />
              </div>
              <span className="text-xs text-gray-500">Done</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 border border-red-500 bg-red-500 bg-opacity-10 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Email Signup */}
          {step === 'email' && (
            <form onSubmit={handleEmailSignup}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-gray-800 px-4 py-3 text-white focus:border-[rgb(255,0,110)] focus:outline-none"
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-gray-800 px-4 py-3 text-white focus:border-[rgb(255,0,110)] focus:outline-none"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all disabled:opacity-50"
              >
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>

              <p className="mt-4 text-xs text-gray-500 text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          )}

          {/* Step 2: Email Verification */}
          {step === 'verify' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-[rgb(255,0,110)] bg-opacity-10 border border-[rgb(255,0,110)] flex items-center justify-center mx-auto mb-4">
                  <Mail size={32} className="text-[rgb(255,0,110)]" />
                </div>
                <h3 className="text-lg font-bold mb-2">CHECK YOUR EMAIL</h3>
                <p className="text-sm text-gray-400">
                  We sent a verification link to <br />
                  <span className="text-white">{email}</span>
                </p>
              </div>

              <div className="mb-6 p-4 border border-gray-800 bg-gray-900 bg-opacity-50 text-left">
                <p className="text-xs text-gray-400 mb-2">NEXT STEPS:</p>
                <ol className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-start">
                    <span className="text-[rgb(255,0,110)] mr-2">1.</span>
                    Check your inbox for the verification email
                  </li>
                  <li className="flex items-start">
                    <span className="text-[rgb(255,0,110)] mr-2">2.</span>
                    Click the verification link
                  </li>
                  <li className="flex items-start">
                    <span className="text-[rgb(255,0,110)] mr-2">3.</span>
                    Return here to connect your wallet
                  </li>
                </ol>
              </div>

              <button
                onClick={() => setStep('wallet')}
                className="w-full py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all"
              >
                I VERIFIED MY EMAIL
              </button>

              <button
                onClick={onClose}
                className="w-full mt-3 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
              >
                I'LL DO THIS LATER
              </button>
            </div>
          )}

          {/* Step 3: Wallet Connection */}
          {step === 'wallet' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-[rgb(255,0,110)] bg-opacity-10 border border-[rgb(255,0,110)] flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} className="text-[rgb(255,0,110)]" />
                </div>
                <h3 className="text-lg font-bold mb-2">CONNECT YOUR WALLET</h3>
                <p className="text-sm text-gray-400">
                  Connect a Web3 wallet to interact with oracles on Base network
                </p>
              </div>

              <div className="mb-6 p-4 border border-gray-800 bg-gray-900 bg-opacity-50 text-left">
                <p className="text-xs text-gray-400 mb-2">WHY CONNECT A WALLET?</p>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-start">
                    <Check size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    Deploy custom oracles on Base
                  </li>
                  <li className="flex items-start">
                    <Check size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    Pay for subscriptions with USDC/ETH/$FEEDS
                  </li>
                  <li className="flex items-start">
                    <Check size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    Manage oracle configurations
                  </li>
                </ul>
              </div>

              {isConnected ? (
                <>
                  <div className="mb-4 p-3 border border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 text-[rgb(0,255,136)]">
                    <p className="text-sm font-bold">✓ Wallet Connected</p>
                    <p className="text-xs mt-1 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                  </div>
                  <button
                    onClick={handleWalletConnected}
                    className="w-full py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all mb-3"
                  >
                    CONTINUE
                  </button>
                </>
              ) : (
                <div className="mb-3 flex justify-center">
                  <ConnectButton />
                </div>
              )}

              <button
                onClick={skipWalletConnection}
                className="w-full py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
              >
                SKIP FOR NOW
              </button>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-[rgb(255,0,110)] flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-black" />
                </div>
                <h3 className="text-lg font-bold mb-2">YOU'RE ALL SET!</h3>
                <p className="text-sm text-gray-400">
                  Your FEEDS account is ready. Start building with decentralized oracles.
                </p>
              </div>

              <div className="mb-6 p-4 border border-gray-800 bg-gray-900 bg-opacity-50 text-left">
                <p className="text-xs text-gray-400 mb-2">WHAT'S NEXT?</p>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-start">
                    <Zap size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    <div>
                      <strong>Create your first oracle</strong>
                      <br />
                      <span className="text-xs text-gray-500">
                        Use AI to configure price feeds in seconds
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <Zap size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    <div>
                      <strong>Explore pricing options</strong>
                      <br />
                      <span className="text-xs text-gray-500">
                        Start free, upgrade as you grow
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <Zap size={16} className="text-[rgb(255,0,110)] mr-2 mt-0.5" />
                    <div>
                      <strong>View network status</strong>
                      <br />
                      <span className="text-xs text-gray-500">
                        Monitor validator health in real-time
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/dashboard';
                }}
                className="w-full py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all mb-3"
              >
                GO TO DASHBOARD
              </button>

              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/pricing';
                }}
                className="w-full py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
              >
                VIEW PRICING
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
