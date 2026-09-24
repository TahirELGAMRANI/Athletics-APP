// Lets a signed-in user permanently delete their own account (required by the App Store).
// Roster entries stay (unlinked) so team history is preserved; bookings and the profile are removed.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data } = await admin.auth.getUser(token);
    if (!data?.user) return json({ error: 'Not signed in' }, 401);

    const { error } = await admin.auth.admin.deleteUser(data.user.id);
    if (error) return json({ error: error.message }, 400);
    return json({ deleted: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
