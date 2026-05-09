import { createClient } from '@libsql/client/http';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

// Robust hex conversion
function hexToUint8Array(hex: string) {
  if (!hex) return new Uint8Array(0);
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().text();

  if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) {
    console.error('Missing signature, timestamp, or public key');
    return { isValid: false };
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(env.DISCORD_PUBLIC_KEY),
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
    console.error('Crypto error:', err);
    return { isValid: false };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET') {
      return new Response('Worker is online!', { status: 200 });
    }

    if (request.method === 'POST') {
      const { isValid, body } = await verifyDiscordRequest(request, env);

      if (!isValid || !body) {
        return new Response('Invalid request signature', { status: 401 });
      }

      const interaction = JSON.parse(body);

      // 1. Handle PING (Critical for Discord verification)
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 2. Handle Slash Commands
      if (interaction.type === 2) {
        const { name, options } = interaction.data;

        if (name === 'ping') {
          return new Response(JSON.stringify({
            type: 4,
            data: { content: '🏓 Pong!' },
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
              data: { content: `✅ Added **${title}**!` },
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
