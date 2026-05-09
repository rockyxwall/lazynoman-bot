import { createClient } from '@libsql/client/http';
import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from 'discord-interactions';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. GET Request -> Landing Page
    if (request.method === 'GET') {
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LazyNoman Bot API</title>
    <style>
        :root {
            --primary-color: #5865F2; --bg-color: #313338; --text-color: #ffffff; --container-bg: #2b2d31;
        }
        body { font-family: sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; background-color: var(--container-bg); padding: 3rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-width: 400px; }
        h1 { color: var(--primary-color); }
        .status-badge { background-color: #23a55a; color: white; padding: 0.5rem 1rem; border-radius: 20px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>LazyNoman Bot</h1>
        <p>This worker handles Discord Webhooks and manages the tracker database.</p>
        <div class="status-badge">Worker is Active</div>
    </div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
    }

    // 2. POST Request -> Discord Webhook or API
    if (request.method === 'POST') {
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');
      const body = await request.text();

      // Verify Discord Webhook Signature
      if (signature && timestamp) {
        console.log('Validating signature...');
        const isValidRequest = verifyKey(
          body,
          signature,
          timestamp,
          env.DISCORD_PUBLIC_KEY
        );

        if (!isValidRequest) {
          console.error('Invalid signature');
          return new Response('Bad request signature', { status: 401 });
        }
        console.log('Signature valid!');

        const interaction = JSON.parse(body);

        // Handle PING (Discord check)
        if (interaction.type === InteractionType.PING) {
          return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Handle Slash Commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
          const { name, options } = interaction.data;

          if (name === 'ping') {
            return new Response(JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: '🏓 Pong! I am running on Cloudflare Workers.' },
            }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (name === 'add') {
            const title = options.find((o: any) => o.name === 'title')?.value;
            const category = options.find((o: any) => o.name === 'category')?.value;
            const status = options.find((o: any) => o.name === 'status')?.value;
            const author = interaction.member?.user?.username || 'unknown';

            try {
              const client = createClient({
                url: env.TURSO_DATABASE_URL,
                authToken: env.TURSO_AUTH_TOKEN,
              });

              await client.execute({
                sql: "INSERT INTO items (title, category, status, author) VALUES (?, ?, ?, ?)",
                args: [title, category, status, author]
              });

              return new Response(JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `✅ Added **${title}** to the tracker!` },
              }), { headers: { 'Content-Type': 'application/json' } });
            } catch (e: any) {
              return new Response(JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `❌ Database Error: ${e.message}` },
              }), { headers: { 'Content-Type': 'application/json' } });
            }
          }
        }
      }

      return new Response('Method Not Allowed', { status: 405 });
    }

    return new Response('Not Found', { status: 404 });
  }
};
