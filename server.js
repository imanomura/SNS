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
  const form_Data = body.form_Data;

  const id = await getNextId();
  //フォームデータにIDと作成日時を追加
  form_Data['id'] = id;
  form_Data['createdAt'] = new Date().toISOString();
  await kv.set(['users', id], form_Data);
  c.status(201);
  c.header('Location', `/api/sns/${id}`);
  return c.json({ form_Data });
});
