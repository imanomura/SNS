// const kv = await Deno.openKv();
import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

Deno.serve(app.fetch);

//getリクエストに対する処理
//まだ書いていない

//postリクエストに対する処理
app.post('/api/sns', async (c) => {
  const body = await c.req.parseBody();
  const record = JSON.parse(body['form_Data']);

  const id = await getNextId();
  record['id'] = id;
  record['createdAt'] = new Date().toISOString();
  await KeyboardEvent.set(['form_Data', id], record);
  c.status(201);
  c.header('Location', `/api/sns/${id}`);
  return c.json({ record });
});
