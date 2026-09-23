import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log("SUPABASE URL:", url);
console.log("SUPABASE KEY VAR:", !!publishableKey);

export const supabase =
  url && publishableKey
    ? createClient(url, publishableKey)
    : null;

export const isSupabaseConfigured = supabase !== null;