"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/components/useOrganization";

export default function OrgNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { organizationId } = useOrganization();
  const [brand, setBrand] = useState<{ name?: string | null; brand_name?: string | null; logo_url?: string | null } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('name,brand_name,logo_url')
        .eq('id', organizationId)
        .maybeSingle();
      if (!cancelled) setBrand((data as typeof brand) ?? null);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  const base = `/org`;
  const links = [
    { href: `${base}/settings`, label: "Settings" },
    { href: `${base}/menu`, label: "Menu" },
    { href: `${base}/tables`, label: "Tables" },
  ];

  const crumbs = (() => {
    const seg = pathname?.split('/').filter(Boolean) ?? [];
    const at = seg.slice(1).join(' / '); // after 'org'
    return at ? `Organization / ${at}` : 'Organization';
  })();

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {brand?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.brand_name || brand.name || 'Logo'} className="h-8 w-auto object-contain" />
            ) : (
              <div className="font-semibold text-lg truncate">{brand?.brand_name || brand?.name || 'Organization'}</div>
            )}
            <div className="text-sm text-gray-600 truncate" title={crumbs}>{crumbs}</div>
          </div>
          <div className="flex items-center gap-2">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1 rounded text-sm ${active ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
                >
                  {l.label}
                </Link>
              );
            })}
            <button
              className="ml-2 px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace('/sign-in');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
