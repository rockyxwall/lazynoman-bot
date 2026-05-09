import { createClient } from '@libsql/client/http';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

// Utility to convert hex string to Uint8Array
function hexToUint8Array(hex: string) {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((val) => parseInt(val, 16)));
}

async function verifyDiscordRequest(request: Request, publicKey: string) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().text();

  if (!signature || !timestamp) return { isValid: false };

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(publicKey),
      { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'NODE-ED25519',
      key,
      hexToUint8Array(signature),
      encoder.encode(timestamp + body)
    );

    return { isValid, body };
  } catch (err) {
    console.error('Verification error:', err);
    return { isValid: false };
  }
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
        body { font-family: sans-serif; background: #313338; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; background: #2b2d31; padding: 2rem; border-radius: 8px; border: 1px solid #5865f2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>LazyNoman Bot</h1>
        <p>Status: <span style="color: #23a55a;">Worker Online</span></p>
    </div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
    }

    // 2. POST Request -> Discord Webhook
    if (request.method === 'POST') {
      const { isValid, body } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);

      if (!isValid || !body) {
        return new Response('Invalid request signature', { status: 401 });
      }

      const interaction = JSON.parse(body);

      // Handle PING
      if (interaction.type === 1) { // InteractionType.PING
        return new Response(JSON.stringify({ type: 1 }), { // InteractionResponseType.PONG
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle Commands
      if (interaction.type === 2) { // InteractionType.APPLICATION_COMMAND
        const { name, options } = interaction.data;

        if (name === 'ping') {
          return new Response(JSON.stringify({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: { content: '🏓 Pong! Webhook is working perfectly.' },
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
              type: 4,
              data: { content: `✅ Added **${title}** to the tracker!` },
            }), { headers: { 'Content-Type': 'application/json' } });
          } catch (e: any) {
            return new Response(JSON.stringify({
              type: 4,
              data: { content: `❌ DB Error: ${e.message}` },
            }), { headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
