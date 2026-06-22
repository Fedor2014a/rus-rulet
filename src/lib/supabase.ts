import { createClient } from '@supabase/supabase-js';

// Ключи берутся из .env.local (локально) и из Vercel → Settings → Environment Variables (на проде).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !url || !anonKey
    ? 'Нет ключей Supabase. Скопируй .env.example → .env.local и вставь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.'
    : '';

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
