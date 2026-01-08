import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
// 認証トークン（JWT）
import { sign, verify as verifyJwt, jwt } from 'jsr:@hono/hono/jwt';

// ファイルの一番上に追加
import { ensureDir } from 'jsr:@std/fs';

// パスワードのハッシュ化（bcrypt）
import { hash, verify } from 'jsr:@felix/bcrypt';

const app = new Hono();
// ★ここに追加！
// 「/」にアクセスが来たら、「/New_member.html」に転送する
app.get('/', (c) => c.redirect('/New_member.html'));

//データベースの有効か
// const kv = await Deno.openKv();
// プロジェクトフォルダ内に 'my_database' というファイルを作って保存するよう指定
const kv = await Deno.openKv('./my_database');

//秘密鍵
// サーバーの秘密鍵

// 修正後（文字は何でもいいですが、忘れないように）
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'himitsu-no-key';

app.use('/*', serveStatic({ root: './public' }));

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

//postリクエストに対する処理
app.post('/api/new_member', async (c) => {
  const form_Data = await c.req.parseBody();
  const username = form_Data['username'];
  const password = form_Data['password'];
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
  // await kv.set(['users', username], { username, hashedPassword });

  const id = await getNextId();

  // 4. 画像ファイルの保存処理（ここを追加！）
  let imageFileName = null;
  const imageFile = form_Data['image'];

  if (imageFile instanceof File && imageFile.size > 0) {
    // ファイル名が被らないようにタイムスタンプなどをつけると安全
    const fileName = `${Date.now()}_${imageFile.name}`;

    // 画像を保存するフォルダを作成（なければ作る）
    await ensureDir('./public/uploads');

    // ファイルの中身を読み込んで保存
    const arrayBuffer = await imageFile.arrayBuffer();
    await Deno.writeFile(`./public/uploads/${fileName}`, new Uint8Array(arrayBuffer));

    // データベースには保存した「ファイル名」を記録
    imageFileName = fileName;
  }

  //一つにまとめる
  const userData = {
    id: id,
    username: username,
    hashedPassword: hashedPassword,
    email: form_Data['email'],
    HB: form_Data['HB'],
    // image: form_Data['image'],
    // 【修正】画像そのものではなく、ファイル名(name)だけを保存するように変更
    // (画像データ自体はFileオブジェクトなので、そのままKVに入れると容量オーバーしやすい)
    // image: form_Data['image'] instanceof File ? form_Data['image'].name : null,
    image: imageFileName,
    createdAt: new Date().toISOString()
  };

  await kv.set(['users', username], userData);
  await kv.set(['usersById', id], userData);

  const payload = {
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
  };
  const token = await sign(payload, JWT_SECRET);

  c.status(201); // 201 Created

  // 返信用のデータをコピーして作成
  const responseUser = {
    id: id,
    username: username,
    hashedPassword: hashedPassword,
    email: form_Data['email'],
    HB: form_Data['HB'],
    // image: form_Data['image'] instanceof File ? form_Data['image'].name : null,
    image: imageFileName,
    createdAt: new Date().toISOString()
  };
  delete responseUser.hashedPassword;

  return c.json({
    message: `ユーザー「${username}」を登録し、ログインしました`,
    user: responseUser,
    token: token // これを追加！
  });
});

/*** ログイン ***/
app.post('/api/login', async (c) => {
  // ...
  const { username, password } = await c.req.json();
  const userEntry = await kv.get(['users', username]);
  const user = userEntry.value;
  if (!user) {
    c.status(401);
    return c.json({ message: 'ユーザー名が無効です。' });
  }
  // ハッシュ化されたパスワードと比較
  const verified = await verify(password, user.hashedPassword);
  if (!verified) {
    c.status(401); // 401 Unauthorized
    return c.json({ message: 'パスワードが無効です' });
  }
  // JWTのペイロードを設定
  const payload = {
    sub: user.username, // ユーザー識別子
    // name: user.username,  // 表示用のユーザー名
    iat: Math.floor(Date.now() / 1000), // 発行日時
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24時間有効
  };
  // JWT（トークン）を生成
  const token = await sign(payload, JWT_SECRET);
  // レスポンス
  return c.json({
    message: 'ログイン成功',
    username: user.username,
    token: token
  });
});

/* 上記以外の /api 以下へのアクセスにはログインが必要 */
app.use('/api/*', jwt({ secret: JWT_SECRET }));

/*** プロフィール ***/
app.get('/api/profile', async (c) => {
  /* ここまで到達できた時点でログインできている */
  // ...
  // ミドルウェアで記録されたキー「jwtPayload」の値を取得
  const payload = c.get('jwtPayload');

  // JWTの本体からユーザー名を取得
  const username = payload.sub;

  return c.json({ username });
});

app.post('/api/post_message', async (c) => {
  const body = await c.req.json();
  const content = body.content;
  // const id = await getNextId();
  // content.id = id;

  if (!content) {
    return c.json({ message: 'メッセージが空です' }, 400);
  }

  // ★ここでトークンからユーザー情報を取得
  const payload = c.get('jwtPayload');
  const userId = payload.sub;

  // 3. 投稿IDの生成 (UUIDを使うのが一番確実です)
  const postId = crypto.randomUUID();

  // 4. 保存するデータを作成
  const message = {
    id: postId,
    userId: userId,
    content: content,
    createdAt: new Date().toISOString()
  };

  // 5. KVに保存 (キーは ['messages', postId] とする)
  await kv.set(['messages', message.id], message);

  c.status(201);
  c.header('Location', '/api/messages/' + message.id);

  return c.json({ message: 'メッセージを保存しました', id: message.id });
});

app.get('/api/posts', async (c) => {
  const items = kv.list({ prefix: ['messages'] });
  const messages = [];
  for await (const item of items) {
    const post = item.value;
    const userEntry = await kv.get(['users', post.userId]);
    const userData = userEntry.value;

    const PostData = {
      id: post.id,
      userId: post.userId,
      content: post.content,
      createdAt: post.createdAt,
      userImage: userData && userData.image ? `/uploads/${userData.image}` : null
    };
    messages.push(PostData);
  }
  // 作成日時の降順でソート
  messages.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return c.json({ messages });
});

//投稿の削除機能
app.delete('/api/messages/:id', async (c) => {
  const id = c.req.param('id');
  const payload = c.get('jwtPayload');
  const currentUserId = payload.sub; // ログイン中のユーザー名

  // 投稿データを取得
  const item = await kv.get(['messages', id]);
  const message = item.value;

  if (!message) {
    return c.json({ message: '投稿が見つかりません' }, 404);
  }

  // 本人確認 (投稿者とログインユーザーが違う場合はエラー)
  if (message.userId !== currentUserId) {
    return c.json({ message: '削除権限がありません' }, 403);
  }

  // 削除実行
  await kv.delete(['messages', id]);

  return c.json({ message: '削除しました' });
});

Deno.serve(app.fetch);
