import { createClient } from '@supabase/supabase-js';

// Ключи берутся из .env.local (локально) и из Vercel → Settings → Environment Variables (на проде).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? 'https://example.supabase.co',
  anonKey ?? 'missing-anon-key',
);
