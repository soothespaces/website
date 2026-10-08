A sensory-focused campus mapping application for finding study spaces based on
environmental conditions (noise, lighting, accessibility) and real-time occupancy.

See [docs/](docs/README.md) for the full project documentation — product overview,
features, technical architecture, and decision log.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This repo uses npm (there's a `package-lock.json`), so use `npm`, not yarn.

### 1. Install

```bash
npm install
```

### 2. Pull env vars from Vercel

The app talks to the production Supabase project, and its settings live in the
Vercel project (`soothespaces`, team `tanner-s-projects`). You need to be a member
of that Vercel team. One-time setup:

```bash
npx vercel login
npx vercel link        # pick tanner-s-projects / soothespaces
```

Then, any time the env vars change:

```bash
npm run env:pull       # = vercel env pull .env.local --environment=production
```

This writes `.env.local` (git-ignored). The Supabase vars are only set for the
Production environment in Vercel, which is why the script passes
`--environment=production`. Vars marked Sensitive in Vercel (service role key,
DB password) come down empty; the app doesn't need them. The two it reads are
listed in [`.env.example`](.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the newer name for the anon key; safe in
  the browser because Row Level Security decides what it can read and write)

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase

- **Clients:** `src/lib/supabase/client.ts` (Client Components) and
  `src/lib/supabase/server.ts` (Server Components, Server Functions, Route
  Handlers). `src/proxy.ts` refreshes the auth session cookie on each request
  (Next 16 renamed `middleware.ts` to `proxy.ts`).
- **Schema changes** are migration files in `supabase/migrations/`, shipped in a PR:
  1. Create one with `npx supabase migration new <name>` and write the SQL.
  2. Open a PR. The **Supabase migrations** workflow applies every migration to a
     throwaway Postgres and lints the result, so broken SQL fails the PR.
  3. Merge to `main`. The Supabase GitHub integration ("Deploy to production") applies
     the new migrations to the production database.

  Don't apply schema changes straight to production (dashboard SQL editor or the MCP
  server's `apply_migration`): the deploy would then try to re-run them, and the repo
  stops being the record of the schema ([ADR 0003](docs/decisions/0003-supabase-as-backend.md)).
  The MCP server is still the way to read the schema, run queries, and check logs.
- **Types:** `src/types/supabase.ts` is generated. Regenerate after a schema change
  with `npm run db:types` (needs `npx supabase login` once), or with the MCP
  server's `generate_typescript_types`.
- **Local stack (optional):** `supabase/config.toml` is there so `npx supabase start`
  can run a local Postgres in Docker, but day-to-day development uses the
  production project.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
