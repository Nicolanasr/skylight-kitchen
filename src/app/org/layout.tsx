"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OrgNav from "@/components/org/OrgNav";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled) return;
      if (!user) {
        const redirect = pathname;
        router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
      } else {
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, pathname]);

  if (checking) return <div className="p-4">Checking authentication…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <OrgNav />
      <main className="max-w-6xl mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
