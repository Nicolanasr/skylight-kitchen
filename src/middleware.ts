import { NextResponse, NextRequest } from "next/server";

// Middleware to propagate tenant slug from host → header
export function middleware(req: NextRequest) {
	const url = new URL(req.url);
	const host = req.headers.get("host") || url.host;
	const slug = getTenantFromHost(host);

	const res = NextResponse.next({ request: { headers: req.headers } });
	res.headers.set("x-tenant", slug);
	return res;
}

function getTenantFromHost(host: string) {
  const h = host.toLowerCase().split(":")[0];
  const parts = h.split(".");
  const DEFAULT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "skylightvillage";
  if (parts.includes("localhost")) {
    if (parts.length >= 2) return parts[0];
    return DEFAULT;
  }
  if (parts.length >= 3) return parts[0];
  return DEFAULT;
}

export const config = {
	matcher: [
		// apply to app routes but skip static assets
		"/((?!_next|.*.(?:css|js|png|jpg|jpeg|gif|svg|ico|mp3)).*)",
	],
};
