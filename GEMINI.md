# LazyNoman Bot: AI Context

**Role:** Serverless Discord interface for the LazyNoman tracker.
**Stack:** Cloudflare Workers, TypeScript, `discord-interactions`, `libsql` (Turso).
**Hosting:** Cloudflare Workers (Interaction Webhook).

## 🏗️ Architecture
- **Serverless:** No persistent bot process. Everything runs in the Cloudflare Worker.
- **Communication:** `Discord Webhook` → `Cloudflare Worker` → `Turso (libsql HTTP)`.
- **Zero Hosting Cost:** Runs entirely on Cloudflare's free/usage tier.

## 🛠️ Commands
- `/add`: Directly handled by the Worker, inserts into Turso.
- `/ping`: Health check handled by the Worker.

## 🔐 Environment Variables (Cloudflare Secrets)
- `DISCORD_PUBLIC_KEY`: Used to verify webhook signatures.
- `TURSO_DATABASE_URL`: Your Turso DB URL.
- `TURSO_AUTH_TOKEN`: Your Turso Auth Token.

## 🚀 Setup & Deployment
1. Set the **Interactions Endpoint URL** in the Discord Developer Portal to your Worker URL.
2. Add secrets to Cloudflare: `npx wrangler secret put DISCORD_PUBLIC_KEY`, etc.
3. Deploy: `npm run deploy`.

## 🤖 Development Rules
- All logic stays in `src/index.ts`.
- Use `verifyKey` for every incoming POST request.
- Keep responses within Discord's 3-second limit.
