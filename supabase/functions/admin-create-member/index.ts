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
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceRoleKey || !authorization) {
    return response({ error: 'Server configuration or admin session is missing.' }, 500);
  }

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return response({ error: 'Sign in again to continue.' }, 401);
  const { data: profile, error: profileError } = await callerClient
    .from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return response({ error: 'Admin access required.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Invalid request body.' }, 400);
  }
  const email = String(body.email || '').trim().toLowerCase();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();
  const mobile = String(body.mobile || '').trim();
  const emergencyContact = String(body.emergencyContact || '').trim();
  const plan = String(body.plan || '').trim();
  const price = Number(body.planPrice);
  const startDate = String(body.startDate || '');
  const expiryDate = String(body.expiryDate || '');
  if (!email || !username || password.length < 6 || !fullName || !mobile || !plan
    || !Number.isFinite(price) || price <= 0 || !startDate || !expiryDate) {
    return response({ error: 'Required member or membership details are missing.' }, 400);
  }
  if (!/^09\d{9}$/.test(mobile) || !/^09\d{9}$/.test(emergencyContact)) {
    return response({ error: 'Mobile and emergency contact numbers must each be 11 digits and start with 09.' }, 400);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (createError || !created.user) {
    return response({ error: createError?.message || 'Could not create Auth user.' }, 400);
  }

  const userId = created.user.id;
  const now = new Date().toISOString();
  const member = {
    auth_user_id: userId,
    user_id: userId,
    full_name: fullName,
    email,
    username,
    mobile,
    date_of_birth: body.dateOfBirth || null,
    age: body.age ?? null,
    sex: body.sex || null,
    height: body.height || null,
    height_unit: body.heightUnit || null,
    weight_kg: body.weight || null,
    weight: body.weight || null,
    emergency_contact: {
      name: body.emergencyName || '',
      relationship: body.emergencyRelationship || '',
      contact: emergencyContact,
    },
    plan,
    plan_price: price,
    start_date: startDate,
    end_date: expiryDate,
    expiry_date: expiryDate,
    status: 'active',
    registration_source: 'Admin registration',
    paid: price,
    fitness_goals: Array.isArray(body.fitnessGoals) ? body.fitnessGoals : [],
    health_conditions: Array.isArray(body.healthConditions) ? body.healthConditions : [],
    other_medical_conditions: String(body.otherMedicalConditions || ''),
    signature_path: body.signatureData || null,
    signature_data: body.signatureData || null,
    created_at: now,
    updated_at: now,
  };
  const receiptNumber = `IG-AR-${crypto.randomUUID().toUpperCase()}`;
  const { data: saved, error: saveError } = await adminClient.rpc('admin_create_member_and_sale', {
    p_admin_id: authData.user.id,
    p_member: member,
    p_receipt_number: receiptNumber,
  });

  if (saveError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
    const cleanupMessage = cleanupError
      ? ` The Auth account could not be removed automatically (${cleanupError.message}); delete it from Auth > Users if needed.`
      : '';
    return response({ error: `${saveError.message}${cleanupMessage}` }, 400);
  }
  return response({ ...saved, email, username, full_name: fullName });
});
