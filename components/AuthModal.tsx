'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Send welcome email via API route
      await fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username }),
      });

      setSuccess('Account created! Please check your email to verify.');
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      setSuccess('Signed in successfully! Redirecting to dashboard...');
      setTimeout(() => {
        onClose();
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess('Password reset email sent! Check your inbox.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'An error occurred sending reset email');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
      <div className="relative bg-black border-2 border-gray-800 max-w-md w-full mx-4" style={{ padding: '40px' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 className="text-2xl font-bold text-white tracking-tight" style={{ marginBottom: '8px' }}>
            {mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'signin' ? 'SIGN IN' : 'RESET PASSWORD'}
          </h2>
          <p className="text-sm text-gray-500">
            {mode === 'signup' ? 'Join the decentralized oracle network' : mode === 'signin' ? 'Access your oracle dashboard' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="border border-red-500 text-red-500 text-sm" style={{ padding: '12px', marginBottom: '24px', backgroundColor: 'rgba(255, 0, 0, 0.1)' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="border text-sm" style={{ borderColor: 'rgb(255, 0, 110)', color: 'rgb(255, 0, 110)', padding: '12px', marginBottom: '24px', backgroundColor: 'rgba(255, 0, 110, 0.1)' }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={mode === 'signup' ? handleSignUp : mode === 'signin' ? handleSignIn : handleForgotPassword}>
          {mode === 'signup' && (
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm text-gray-400" style={{ marginBottom: '8px' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors"
                placeholder="Enter username"
              />
            </div>
          )}

          <div style={{ marginBottom: mode === 'forgot' ? '32px' : '24px' }}>
            <label className="block text-sm text-gray-400" style={{ marginBottom: '8px' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors"
              placeholder="Enter email"
            />
          </div>

          {mode !== 'forgot' && (
            <div style={{ marginBottom: '32px' }}>
              <label className="block text-sm text-gray-400" style={{ marginBottom: '8px' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors"
                placeholder="Enter password"
              />
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs text-gray-500 hover:text-white transition-colors mt-2"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border text-white font-bold py-3 transition-all disabled:opacity-50"
            style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'transparent')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)')}
          >
            {loading ? 'PROCESSING...' : mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'signin' ? 'SIGN IN' : 'SEND RESET LINK'}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="text-center" style={{ marginTop: '24px' }}>
          {mode === 'forgot' ? (
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Back to sign in
            </button>
          ) : (
            <button
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
