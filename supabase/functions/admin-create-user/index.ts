// Creates an account on behalf of a super admin (players, coaches, staff, students…).
// Deployed with verify_jwt = true; we additionally check the caller's role.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['super_admin', 'admin', 'coach', 'player', 'student'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: 'Not signed in' }, 401);
    const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
    if (me?.role !== 'super_admin') return json({ error: 'Only super admins can create accounts' }, 403);

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role = String(body.role ?? '');
    const fullName = String(body.full_name ?? '').trim();
    if (!email || password.length < 8 || !ROLES.includes(role) || !fullName) {
      return json({ error: 'Email, full name, role and a password of 8+ characters are required' }, 400);
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName, title: body.title ?? null },
    });
    if (error) return json({ error: error.message }, 400);
    const uid = created.user.id;

    // Optional links
    if (body.player_id) {
      await admin.from('players').update({ profile_id: uid, email }).eq('id', body.player_id);
    }
    if (role === 'coach' && body.team_id) {
      await admin.from('team_coaches').upsert({ team_id: body.team_id, profile_id: uid });
    }
    if (body.staff_id) {
      await admin.from('staff').update({ profile_id: uid }).eq('id', body.staff_id);
    }
    return json({ id: uid, email, role });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
