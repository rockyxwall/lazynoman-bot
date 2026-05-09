# LazyNoman Bot: AI Context

**Role:** Discord interface for the LazyNoman tracker.
**Stack:** Bun, TypeScript, Discord.js v14, Axios.
**Hosting:** Railway or Fly.io (Persistent Process).

## 🏗️ Architecture
- **Relationship:** Strictly decoupled from the Astro repository.
- **Communication:** `Bot` → `HTTP POST` → `Cloudflare Worker API` → `Turso/D1 Database`.
- **Zero Local File Access:** Does NOT read MDX or local Astro files.

## 🛠️ Commands
- `/add`: Sends title, category, and status to the Worker API.
- `/ping`: Health check for bot connectivity.

## 🔐 Environment Variables (.env)
- `DISCORD_TOKEN`: Bot token from Discord Developer Portal.
- `DISCORD_CLIENT_ID`: Application ID.
- `CF_WORKER_URL`: The endpoint of your Cloudflare Worker (e.g., `https://.../api/novel`).
- `API_SECRET`: Shared bearer token to authorize the bot with the Worker.

## 🚀 Deployment (Fly.io)
1. `fly secrets set DISCORD_TOKEN="..." API_SECRET="..."`
2. `fly deploy`

## 🤖 Development Rules
- Use `SlashCommandBuilder` for all new commands.
- Always `deferReply()` for API calls to prevent 3s timeouts.
- Use `axios` for all external communication.
- Keep `index.ts` lean; move logic to `/src` if it grows.
