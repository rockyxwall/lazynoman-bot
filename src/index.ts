import { createClient } from '@libsql/client/web';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  API_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Preflight/Health Check / Landing Page
    if (request.method === 'GET') {
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LazyNoman Bot API</title>
    <style>
        :root {
            --primary-color: #5865F2; /* Discord Blurple */
            --bg-color: #313338;
            --text-color: #ffffff;
            --container-bg: #2b2d31;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            text-align: center;
            background-color: var(--container-bg);
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            max-width: 400px;
            width: 90%;
        }
        h1 {
            color: var(--primary-color);
            margin-bottom: 1rem;
            font-size: 2rem;
        }
        p {
            line-height: 1.6;
            color: #b5bac1;
            margin-bottom: 2rem;
        }
        .status-badge {
            background-color: #23a55a;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: bold;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>LazyNoman Bot</h1>
        <p>This is the API backend for the LazyNoman tracker. It handles requests from the Discord bot and manages the database.</p>
        <div class="status-badge">Worker is Active</div>
    </div>
</body>
</html>`, { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
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
