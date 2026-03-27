# Rush

Rush is a campus recruiting platform for club discovery, deadline tracking, and
application workflow management.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- pnpm

## Development

Install dependencies and start the development server:

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set the values in `.env.local` from your Supabase project before using auth or
database features.

## Current Scope

The initial build order is product-first:

1. Club directory and SEO-friendly club pages
2. Student dashboard and application tracker
3. Club claim flow and recruiter portal
4. Notifications and operational tooling
5. Recommendation system after enough usage data exists
