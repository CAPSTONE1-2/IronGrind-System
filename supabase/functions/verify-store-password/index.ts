import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const configuredPassword = Deno.env.get('STORE_ACCESS_PASSWORD');
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !configuredPassword || !authorization) {
    return response({ error: 'Store password verification is not configured.' }, 503);
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return response({ error: 'Sign in again to continue.' }, 401);

  const { data: profile, error: profileError } = await client
    .from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return response({ error: 'Admin access required.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Invalid request body.' }, 400);
  }
  const submittedPassword = typeof body.password === 'string' ? body.password : '';
  if (!submittedPassword || submittedPassword.length > 1024) {
    return response({ authorized: false, error: 'Incorrect Store password.' });
  }

  return submittedPassword === configuredPassword
    ? response({ authorized: true })
    : response({ authorized: false, error: 'Incorrect Store password.' });
});
