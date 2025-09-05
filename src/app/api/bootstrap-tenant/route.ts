import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orgSlug, orgName, venueName, venueSlug } = body as {
      orgSlug: string; orgName: string; venueName?: string; venueSlug?: string;
    };
    if (!orgSlug || !orgName) {
      return NextResponse.json({ error: 'orgSlug and orgName are required' }, { status: 400 });
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // 1) Create organization if not exists
    const { data: orgExisting } = await supabase.from('organizations').select('id, slug').eq('slug', orgSlug).maybeSingle();
    let orgId = orgExisting?.id as string | undefined;
    if (!orgId) {
      const { data: created, error: orgErr } = await supabase.from('organizations').insert([{ slug: orgSlug, name: orgName }]).select('id').single();
      if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });
      orgId = created!.id;
    }

    // 2) Ensure membership as owner
    await supabase.from('org_members')
      .upsert({ organization_id: orgId, user_id: user.id, role: 'owner' }, { onConflict: 'organization_id,user_id' });

    // 3) Create default venue if provided
    let venueId: string | undefined;
    if (venueName && venueSlug) {
      const { data: existingVenue } = await supabase.from('venues')
        .select('id').eq('organization_id', orgId).eq('slug', venueSlug).maybeSingle();
      if (!existingVenue) {
        const { data: createdV, error: vErr } = await supabase.from('venues')
          .insert([{ organization_id: orgId, name: venueName, slug: venueSlug }])
          .select('id').single();
        if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });
        venueId = createdV!.id;
      } else {
        venueId = existingVenue.id;
      }
    }

    return NextResponse.json({ organization_id: orgId, venue_id: venueId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
