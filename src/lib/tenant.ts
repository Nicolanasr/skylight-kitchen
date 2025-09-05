"use client";

// Lightweight tenant utilities for routing.
// Supports both path-based (/t/:slug/...) and subdomain-based (<slug>.<domain>) detection.
// - Local dev: <tenant>.localhost:3000 or /t/<tenant>/...

export type Tenant = {
	slug: string;
	// Optionally, cache resolved organization id once fetched
	organizationId?: string;
};

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "skylightvillage";

export function getTenantSlugFromHost(host?: string): string {
	if (!host && typeof window !== "undefined") host = window.location.host;
	if (!host) return DEFAULT_TENANT;

	const lower = host.toLowerCase();
	// Strip port
	const h = lower.split(":")[0];
	const parts = h.split(".");

	// localhost: assume <tenant>.localhost or fallback
	if (parts.includes("localhost")) {
		if (parts.length >= 2) return parts[0];
		return DEFAULT_TENANT;
	}

	// production: tenant.domain.com -> tenant
	if (parts.length >= 3) return parts[0];
	return DEFAULT_TENANT;
}

export function getTenantSlugFromPath(): string | null {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/^\/t\/([^/]+)(?:\/|$)/);
    return m ? m[1] : null;
}

export function getCurrentTenant(): Tenant {
	const byPath = getTenantSlugFromPath();
	const slug = byPath || getTenantSlugFromHost();
	return { slug };
}
