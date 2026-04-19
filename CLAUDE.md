# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Next.js dev server (hot reload)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm preview      # Build and preview on local Cloudflare runtime
pnpm deploy       # Build and deploy to Cloudflare Workers
pnpm cf-typegen   # Regenerate TypeScript types for Cloudflare env bindings
```

There is no test runner configured.

## Architecture

**HackaPlace** is a r/place-style collaborative pixel canvas (500×500) deployed as a Next.js 15 app on Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). The app uses the App Router.

### Canvas

The main page (`src/app/page.tsx`) renders the canvas client-side using [Konva](https://konvajs.org/) (`react-konva`). It:
1. Fetches all pixels from Supabase on load and draws them onto an `OffscreenCanvas`
2. Subscribes to Supabase Realtime `postgres_changes` on the `pixel` table for live updates
3. Sends pixel placements to `POST /api/place`, then updates the local canvas optimistically

Canvas constants (`canvasWidth`, `canvasHeight`, `cooldown`) live in `src/lib/utils.ts`. The cooldown is 60 seconds. Placing a white pixel (`0xffffff`) deletes the row from the database rather than upserting it (white = background).

### API

`POST /api/place` (`src/app/api/place/route.ts`):
- Requires an active Better Auth session (returns 401 otherwise)
- Enforces the 60-second cooldown via `user.lastPlaceTime`, bypassed for users where `user.unlimitedPlace` is `true`
- Validates body with Zod: `{ x, y, color }` where color is an integer 0–0xFFFFFF
- Updates `lastPlaceTime` in the user table, then fires the DB upsert/delete asynchronously

### Authentication

Auth is handled by [Better Auth](https://better-auth.com) (`src/lib/auth.ts` for server, `src/lib/auth-client.ts` for client). It supports:
- OAuth2 via Hack Club's OIDC provider (`https://auth.hackclub.com`) using the `genericOAuth` plugin

All auth API routes are handled by a single catch-all route at `src/app/api/auth/[...all]/route.ts`.

The database backend for auth is PostgreSQL (Supabase pooler, `BETTER_AUTH_DB_URL`). Better Auth adds two custom fields to the `user` table: `lastPlaceTime` (date, tracks cooldown) and `unlimitedPlace` (boolean, admin bypass).

### Supabase

Two separate clients exist:
- `src/lib/supabase.ts` — **server-side**, uses `SUPABASE_SECRET_KEY` (service role). Used in API routes.
- `src/lib/supabase.client.ts` — **client-side**, uses `NEXT_PUBLIC_SUPABASE_KEY` (anon). Used in the page component for reads and Realtime.

TypeScript types for the Supabase schema are in `src/lib/supabase.types.ts`.

### Environment variables

| Variable | Used by |
|---|---|
| `BETTER_AUTH_DB_URL` | Better Auth (Postgres connection string) |
| `HACK_CLUB_CLIENT_ID` / `HACK_CLUB_CLIENT_SECRET` | Hack Club OAuth |
| `NEXT_PUBLIC_SUPABASE_URL` | Both Supabase clients |
| `SUPABASE_SECRET_KEY` | Server Supabase client (service role) |
| `NEXT_PUBLIC_SUPABASE_KEY` | Client Supabase client (anon key) |

Local secrets go in `.env`. Cloudflare bindings are typed in `cloudflare-env.d.ts` — regenerate with `pnpm cf-typegen` after changing `wrangler.jsonc`.

The `next.config.ts` initializes the OpenNext Cloudflare dev server — keep `initOpenNextCloudflareForDev()` at the top.

### Deployment

Wrangler config is in `wrangler.jsonc`. The app has a self-referencing service binding (`SELF`) and built-in Cloudflare image optimization + observability enabled.
