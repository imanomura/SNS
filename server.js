const kv = await Deno.openKv();
import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
const app = new Hono();

await kv.set(['Counter', 0], { count: 0, user: [] });
