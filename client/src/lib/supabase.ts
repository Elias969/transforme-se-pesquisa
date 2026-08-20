import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wvibhhkjatxcnacylsso.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__nyCuB4ptZ7Qm_LrKOMMYw_1NfXinQz';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);