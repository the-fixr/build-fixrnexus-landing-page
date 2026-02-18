'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived via password reset link
        setIsRecoveryFlow(true);
        setIsValidSession(true);
      } else if (event === 'SIGNED_IN' && !isRecoveryFlow) {
        // Check if this is from a recovery flow by looking at URL hash
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          setIsRecoveryFlow(true);
          setIsValidSession(true);
        }
      }
    });

    // Also check current session and URL on mount
    const checkSession = async () => {
      // Check URL hash for recovery token
      const hash = window.location.hash;
      if (hash.includes('type=recovery') || hash.includes('access_token')) {
        // Let the auth state change handler process the token
        setIsValidSession(true);
        setIsRecoveryFlow(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If user has a session but didn't come through recovery flow,
        // they might be a regular logged-in user who navigated here
        setIsValidSession(true);
        setIsRecoveryFlow(true); // Allow password change anyway
      } else {
        setIsValidSession(false);
      }
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred updating your password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Verifying reset link...</div>
      </div>
    );
  }

  // Invalid or expired session - only show if we're certain there's no valid session
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-black border-2 border-gray-800 p-10 text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Invalid or Expired Link</h1>
          <p className="text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full border text-white font-bold py-3 transition-all"
            style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-black border-2 border-gray-800 p-10 text-center">
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'rgb(255, 0, 110)' }} />
          <h1 className="text-2xl font-bold text-white mb-4">Password Updated</h1>
          <p className="text-gray-400">
            Your password has been successfully updated. Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-black border-2 border-gray-800 p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Lock size={48} className="mx-auto mb-4" style={{ color: 'rgb(255, 0, 110)' }} />
          <h1 className="text-2xl font-bold text-white mb-2">SET NEW PASSWORD</h1>
          <p className="text-sm text-gray-500">Enter your new password below</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="border border-red-500 text-red-500 text-sm p-3 mb-6" style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleResetPassword}>
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              NEW PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors"
              placeholder="Enter new password"
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border text-white font-bold py-3 transition-all disabled:opacity-50"
            style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
          >
            {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </form>

        {/* Back link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
