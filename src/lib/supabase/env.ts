// Public Supabase settings. Both values are safe to expose to the browser:
// the publishable key (the successor to the "anon" key) only grants what
// Row Level Security allows. Pull them locally with `vercel env pull` (see README).
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Run `vercel env pull .env.local --environment=production` (see README).",
    );
  }
  return env;
}
