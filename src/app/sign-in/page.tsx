"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { slug } = getCurrentTenant();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      const redirect = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
      const target = redirect && redirect.startsWith('/') ? redirect : `/t/${slug}/kitchen`;
      router.replace(target);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <form onSubmit={signIn} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2" required />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className={`w-full py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button onClick={signOut} className="mt-3 text-sm text-gray-600 underline">Sign out</button>
      </div>
    </div>
  );
}
