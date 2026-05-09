import { createClient } from '@libsql/client/web';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  API_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Preflight/Health Check
    if (request.method === 'GET') {
      return new Response('Worker is running!', { status: 200 });
    }

    // 2. Auth Check
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${env.API_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method === 'POST') {
      try {
        const { title, category, status, author } = await request.json() as any;
        
        if (!title || !category || !status) {
          return new Response('Missing required fields', { status: 400 });
        }

        const client = createClient({
          url: env.TURSO_DATABASE_URL,
          authToken: env.TURSO_AUTH_TOKEN,
        });

        await client.execute({
          sql: "INSERT INTO items (title, category, status, author) VALUES (?, ?, ?, ?)",
          args: [title, category, status, author || 'unknown']
        });
        
        return new Response(JSON.stringify({ success: true }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        console.error(e);
        return new Response(`Database Error: ${e.message}`, { status: 500 });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};
