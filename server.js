import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
const app = new Hono();

//データベースの有効か
const kv = await Deno.openKv();

app.use('/*', serveStatic({ root: './public' }));

Deno.serve(app.fetch);

//新しいIDを取得する関数
async function getNextId() {
  // pokemonコレクション用のカウンタのキー
  const key = ['counter', 'pokemon'];

  // アトミック処理の中でカウンターに1を足す
  const res = await kv.atomic().sum(key, 1n).commit();

  // 確認
  if (!res.ok) {
    console.error('IDの生成に失敗しました。');
    return null;
  }

  // カウンターをgetして…
  const counter = await kv.get(key);

  // Number型としてreturnする
  return Number(counter.value);
}

//getリクエストに対する処理
app.get('/api/login', async (c) => {});
//まだ書いていない

//postリクエストに対する処理
app.post('/api/new_member', async (c) => {
  const form_Data = await c.req.parseBody();

  // const form_Data = body.form_Data;

  const id = await getNextId();
  //フォームデータにIDと作成日時を追加
  form_Data['id'] = id;
  form_Data['createdAt'] = new Date().toISOString();
  await kv.set(['users', id], form_Data);
  c.status(201);
  c.header('Location', `/api/new_member/${id}`);
  return c.json({ form_Data });
});
