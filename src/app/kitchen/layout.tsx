"use client";

import AuthGate from '@/components/AuthGate';

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {children}
    </AuthGate>
  );
}

