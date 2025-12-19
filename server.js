import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
// 認証トークン（JWT）
import { jwt, sign } from 'jsr:@hono/hono/jwt';

// パスワードのハッシュ化（bcrypt）
import { hash, verify } from 'jsr:@felix/bcrypt';
const app = new Hono();

//データベースの有効か
const kv = await Deno.openKv();

//秘密鍵
// サーバーの秘密鍵
const JWT_SECRET = Deno.env.get('JWT_SECRET');

app.use('/*', serveStatic({ root: './public' }));

Deno.serve(app.fetch);

//新しいIDを取得する関数
async function getNextId() {
  // userIdコレクション用のカウンタのキー
  const key = ['counter', 'userId'];

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
  const username = form_Data.get['username'];
  const password = form_Data.get['password'];
  // 登録情報の取得
  if (!username || !password) {
    c.status(400); // 400 Bad Request
    return c.json({ message: 'ユーザー名とパスワードは必須です' });
  }
  // 同じユーザー名がデータベースにないか確認
  const userExists = await kv.get(['users', username]);
  if (userExists.value) {
    c.status(409); // 409 Conflict
    return c.json({ message: 'このユーザー名は既に使用されています' });
  }
  // パスワードをハッシュ化してユーザー名とともにデータベースに記録
  const hashedPassword = await hash(password);
  await kv.set(['users', username], { username, hashedPassword });

  // const form_Data = body.form_Data;

  const id = await getNextId();
  //フォームデータにIDと作成日時を追加
  form_Data['id'] = id;
  // form_Data['createdAt'] = new Date().toISOString();

  //一つにまとめる
  const userData = {
    id: id,
    username: username,
    hashedPassword: hashedPassword,
    email: form_Data.get['email'],
    HB: form_Data.get['HB'],
    image: form_Data.get['image']
  };

  await kv.set(['users', username], userData);
  await kv.set(['usersById', id], userData);
  // await kv.set(['users', id]);
  // c.status(201);
  // c.header('Location', `/api/new_member/${id}`);
  // return c.json({ form_Data });

  c.status(201); // 201 Created
  return c.json({ message: `ユーザー「${username}」を登録しました` });
});
