import { createClient } from '@libsql/client/http';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

/**
 * Validates a hex string and converts it to Uint8Array
 */
function hexToUint8Array(hex: string) {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

/**
 * Verify the signature of an incoming Discord request
 */
async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().text();

  if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) {
    return { isValid: false, reason: 'Missing headers or Public Key' };
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(env.DISCORD_PUBLIC_KEY.trim()),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      key,
      hexToUint8Array(signature),
      encoder.encode(timestamp + body)
    );

    return { isValid, body, reason: isValid ? null : 'Signature mismatch' };
  } catch (err: any) {
    return { isValid: false, reason: `Crypto error: ${err.message}` };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log(`Incoming request: ${request.method} ${request.url}`);
    
    // 1. Health Check
    if (request.method === 'GET') {
      return new Response('Worker is online!', { status: 200 });
    }

    // 2. Discord Interaction Handler
    if (request.method === 'POST') {
      try {
        const { isValid, body, reason } = await verifyDiscordRequest(request, env);

        if (!isValid || !body) {
          console.error(`Verification Failed: ${reason}`);
          return new Response(JSON.stringify({ error: 'Invalid signature', reason }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const interaction = JSON.parse(body);

        // Handle Discord PING (Type 1)
        if (interaction.type === 1) {
          return new Response(JSON.stringify({ type: 1 }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Handle Application Commands (Type 2)
        if (interaction.type === 2) {
          const { name, options } = interaction.data;

          if (name === 'ping') {
            return new Response(JSON.stringify({
              type: 4,
              data: { content: '🏓 Pong! Webhook is verified.' },
            }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (name === 'add') {
            const title = options.find((o: any) => o.name === 'title')?.value;
            const category = options.find((o: any) => o.name === 'category')?.value;
            const status = options.find((o: any) => o.name === 'status')?.value;
            const author = interaction.member?.user?.username || interaction.user?.username || 'unknown';

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
          }
        }

        return new Response('Unknown interaction type', { status: 400 });
      } catch (err: any) {
        console.error('Worker Error:', err);
        return new Response(err.message, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
