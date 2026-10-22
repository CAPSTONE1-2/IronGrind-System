// Public browser configuration. The publishable key is safe to expose when
// database tables are protected by Row Level Security policies.
const IRON_GRIND_SUPABASE_URL = 'https://nttsrdassmzvtaamyogi.supabase.co';
const IRON_GRIND_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aJUpD0v8XUengFdItDJGQw_rZK4anzm';

window.ironGrindSupabase = window.supabase.createClient(
    IRON_GRIND_SUPABASE_URL,
    IRON_GRIND_SUPABASE_PUBLISHABLE_KEY
);
