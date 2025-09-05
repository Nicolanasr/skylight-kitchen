"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSignedIn(Boolean(data.session));
      setLoading(false);
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const current = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/kitchen';
  const { slug } = getCurrentTenant();
  const signInHref = `/t/${slug}/sign-in?redirect=${encodeURIComponent(current)}`;

  if (loading) return <div className="p-4">Loading...</div>;
  if (!signedIn) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-xl font-semibold mb-2">Staff Sign-in Required</h2>
        <p className="text-gray-600 mb-4">Please sign in to access the kitchen.</p>
        <Link href={signInHref} className="inline-block px-4 py-2 bg-blue-600 text-white rounded">Go to Sign in</Link>
      </div>
    );
  }
  return <>{children}</>;
}
