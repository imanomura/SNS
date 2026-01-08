import { Hono } from 'jsr:@hono/hono';
import { serveStatic } from 'jsr:@hono/hono/deno';
// 認証トークン（JWT）
import { sign, verify as verifyJwt, jwt } from 'jsr:@hono/hono/jwt';

// ファイルの一番上に追加
import { ensureDir } from 'jsr:@std/fs';

// パスワードのハッシュ化（bcrypt）
import { hash, verify } from 'jsr:@felix/bcrypt';

const app = new Hono();
// 「/」にアクセスが来たら、「/New_member.html」に転送する
app.get('/', (c) => c.redirect('/New_member.html'));

// プロジェクトフォルダ内に 'my_database' というファイルを作って保存するよう指定
const kv = await Deno.openKv('./my_database');

// 秘密鍵
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'himitsu-no-key';

app.use('/*', serveStatic({ root: './public' }));

//新しいIDを取得する関数
async function getNextId() {
  const key = ['counter', 'userId'];
  const res = await kv.atomic().sum(key, 1n).commit();
  if (!res.ok) {
    console.error('IDの生成に失敗しました。');
    return null;
  }
  const counter = await kv.get(key);
  return Number(counter.value);
}

//postリクエストに対する処理
app.post('/api/new_member', async (c) => {
  const form_Data = await c.req.parseBody();
  const username = form_Data['username'];
  const password = form_Data['password'];

  if (!username || !password) {
    c.status(400);
    return c.json({ message: 'ユーザー名とパスワードは必須です' });
  }

  const userExists = await kv.get(['users', username]);
  if (userExists.value) {
    c.status(409);
    return c.json({ message: 'このユーザー名は既に使用されています' });
  }

  const hashedPassword = await hash(password);
  const id = await getNextId();

  let imageFileName = null;
  const imageFile = form_Data['image'];

  if (imageFile instanceof File && imageFile.size > 0) {
    const fileName = `${Date.now()}_${imageFile.name}`;
    await ensureDir('./public/uploads');
    const arrayBuffer = await imageFile.arrayBuffer();
    await Deno.writeFile(`./public/uploads/${fileName}`, new Uint8Array(arrayBuffer));
    imageFileName = fileName;
  }

  const userData = {
    id: id,
    username: username,
    displayName: username,
    hashedPassword: hashedPassword,
    email: form_Data['email'],
    HB: form_Data['HB'],
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

  c.status(201);

  const responseUser = {
    id: id,
    username: username,
    hashedPassword: hashedPassword,
    email: form_Data['email'],
    HB: form_Data['HB'],
    image: imageFileName,
    createdAt: new Date().toISOString()
  };
  delete responseUser.hashedPassword;

  return c.json({
    message: `ユーザー「${username}」を登録し、ログインしました`,
    user: responseUser,
    token: token
  });
});

/*** ログイン ***/
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  const userEntry = await kv.get(['users', username]);
  const user = userEntry.value;
  if (!user) {
    c.status(401);
    return c.json({ message: 'ユーザー名が無効です。' });
  }
  const verified = await verify(password, user.hashedPassword);
  if (!verified) {
    c.status(401);
    return c.json({ message: 'パスワードが無効です' });
  }
  const payload = {
    sub: user.username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
  };
  const token = await sign(payload, JWT_SECRET);
  return c.json({
    message: 'ログイン成功',
    username: user.username,
    token: token
  });
});

/* 上記以外の /api 以下へのアクセスにはログインが必要 */
app.use('/api/*', jwt({ secret: JWT_SECRET }));

/*** プロフィール ***/
app.get('/api/user_info', async (c) => {
  const queryUser = c.req.query('user');
  const payload = c.get('jwtPayload');
  const me = payload.sub;
  const targetUsername = queryUser || me;

  const userEntry = await kv.get(['users', targetUsername]);
  const user = userEntry.value;

  if (!user) return c.json({ message: 'ユーザーが見つかりません' }, 404);

  // フォロー数（自分自身が含まれていたら除外する）
  const followingIter = kv.list({ prefix: ['follows', targetUsername] });
  let followingCount = 0;
  for await (const item of followingIter) {
    if (item.key[2] === targetUsername) continue;
    followingCount++;
  }

  // フォロワー数（自分自身が含まれていたら除外する）
  const followersIter = kv.list({ prefix: ['followers', targetUsername] });
  let followersCount = 0;
  for await (const item of followersIter) {
    if (item.key[2] === targetUsername) continue;
    followersCount++;
  }

  // 自分がこの人をフォローしているか確認
  let isFollowing = false;
  if (me !== targetUsername) {
    const check = await kv.get(['follows', me, targetUsername]);
    isFollowing = !!check.value;
  }

  return c.json({
    username: user.username,
    displayName: user.displayName || user.username,
    image: user.image ? `/uploads/${user.image}` : null,
    bio: user.bio || '自己紹介はまだありません',
    isMe: me === user.username,
    followingCount,
    followersCount,
    isFollowing
  });
});

/* --- プロフィール更新 --- */
app.post('/api/profile/update', async (c) => {
  const payload = c.get('jwtPayload');
  const currentUsername = payload.sub;

  const formData = await c.req.parseBody();
  const newDisplayName = formData['displayName'];
  const newBio = formData['bio'];
  const imageFile = formData['image'];

  const key = ['users', currentUsername];
  const userEntry = await kv.get(key);
  const userData = userEntry.value;

  if (!userData) return c.json({ message: 'ユーザー不在' }, 404);

  if (newDisplayName) userData.displayName = newDisplayName;
  if (newBio) userData.bio = newBio;

  if (imageFile instanceof File && imageFile.size > 0) {
    const fileName = `${Date.now()}_${imageFile.name}`;
    await ensureDir('./public/uploads');
    const arrayBuffer = await imageFile.arrayBuffer();
    await Deno.writeFile(`./public/uploads/${fileName}`, new Uint8Array(arrayBuffer));
    userData.image = fileName;
  }

  await kv.set(key, userData);
  return c.json({ message: 'プロフィールを更新しました' });
});

app.post('/api/post_message', async (c) => {
  const body = await c.req.json();
  const content = body.content;
  // ★追加: 公開設定を受け取る（なければ 'public'）
  const visibility = body.visibility || 'public';

  // ★追加: 親投稿のID（返信の場合のみ存在する）
  const parentId = body.parentId || null;

  if (!content) {
    return c.json({ message: 'メッセージが空です' }, 400);
  }

  const payload = c.get('jwtPayload');
  const userId = payload.sub;

  const postId = crypto.randomUUID();

  const message = {
    id: postId,
    userId: userId,
    content: content,
    createdAt: new Date().toISOString(),
    visibility: visibility, // ★追加: ここに保存
    parentId: parentId // ★追加: ここに保存
  };

  await kv.set(['messages', message.id], message);

  c.status(201);
  c.header('Location', '/api/messages/' + message.id);
  return c.json({ message: 'メッセージを保存しました', id: message.id });
});

/* --- タイムライン取得（ここを整理しました） --- */
app.get('/api/posts', async (c) => {
  const targetUser = c.req.query('user');
  const type = c.req.query('type');

  const payload = c.get('jwtPayload');
  const me = payload.sub;

  // 1. フォローリストの準備
  // 「フォロー中」タブの場合のみ、フォローしている人のリスト(Set)を作る
  let followingSet = null;

  if (type === 'following') {
    followingSet = new Set();
    const iter = kv.list({ prefix: ['follows', me] });
    for await (const item of iter) {
      const target = item.key[2];
      // 自分自身はリストに入れない
      if (target !== me) {
        followingSet.add(target);
      }
    }
  }

  const items = kv.list({ prefix: ['messages'] });
  const messages = [];

  for await (const item of items) {
    const post = item.value;

    // --- ★ここからフィルタリング処理を修正 ---

    // 1. 「じぶんだけ」モードの場合
    if (type === 'private') {
      // 自分の投稿、かつ visibility が private のものだけ許可
      if (post.userId !== me) continue;
      if (post.visibility !== 'private') continue;
    }
    // 2. それ以外のモード（おすすめ、フォロー中、プロフィール）
    else {
      // visibility が private のものは、他人は絶対に見られない
      // (自分が見る場合でも、通常のタイムラインには混ぜない仕様にします)
      if (post.visibility === 'private') continue;
    }

    // A. プロフィール画面用: 特定ユーザーの投稿のみ
    if (targetUser) {
      if (post.userId !== targetUser) continue;
    }

    // B. ホーム画面（フォロー中タブ）用
    if (type === 'following') {
      // B-1: 自分の投稿は表示しない
      if (post.userId === me) continue;

      // B-2: フォローリストが空、またはフォローしていない人の投稿は表示しない
      // (followingSet が null または、Setの中にuserIdがない場合はスキップ)
      if (!followingSet || !followingSet.has(post.userId)) {
        continue;
      }
    }

    // ★追加: 返信元（親投稿）の情報を取得する処理
    let parentInfo = null;
    if (post.parentId) {
      // 親投稿のデータを取得
      const parentEntry = await kv.get(['messages', post.parentId]);
      const parentMsg = parentEntry.value;

      if (parentMsg) {
        // 親投稿のユーザー情報を取得
        const parentUserEntry = await kv.get(['users', parentMsg.userId]);
        const parentUser = parentUserEntry.value;

        parentInfo = {
          displayName: parentUser ? parentUser.displayName || parentUser.username : '不明なユーザー',
          content: parentMsg.content
        };
      } else {
        // 親投稿が削除されていた場合
        parentInfo = { displayName: '削除された投稿', content: 'この投稿は削除されました' };
      }
    }

    // --- ユーザー情報の結合 ---
    const userEntry = await kv.get(['users', post.userId]);
    const userData = userEntry.value;

    const PostData = {
      id: post.id,
      userId: post.userId,
      displayName: userData ? userData.displayName || userData.username : post.userId,
      content: post.content,
      createdAt: post.createdAt,
      userImage: userData && userData.image ? `/uploads/${userData.image}` : null,
      visibility: post.visibility, // フロントでアイコン表示などに使うかも
      parent: parentInfo // ★追加: これをフロントエンドに送る
    };
    messages.push(PostData);
  }

  messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return c.json({ messages });
});

//投稿の削除機能
app.delete('/api/messages/:id', async (c) => {
  const id = c.req.param('id');
  const payload = c.get('jwtPayload');
  const currentUserId = payload.sub;

  const item = await kv.get(['messages', id]);
  const message = item.value;

  if (!message) {
    return c.json({ message: '投稿が見つかりません' }, 404);
  }

  if (message.userId !== currentUserId) {
    return c.json({ message: '削除権限がありません' }, 403);
  }

  await kv.delete(['messages', id]);
  return c.json({ message: '削除しました' });
});

/* --- フォローの切り替え --- */
app.post('/api/follow/:targetUser', async (c) => {
  const payload = c.get('jwtPayload');
  const me = payload.sub;
  const target = c.req.param('targetUser');

  if (me === target) {
    return c.json({ message: '自分自身はフォローできません' }, 400);
  }

  const followKey = ['follows', me, target];
  const followerKey = ['followers', target, me];

  const existing = await kv.get(followKey);

  if (existing.value) {
    const atom = kv.atomic();
    atom.delete(followKey);
    atom.delete(followerKey);
    await atom.commit();
    return c.json({ isFollowing: false, message: 'フォロー解除しました' });
  } else {
    const now = new Date().toISOString();
    const atom = kv.atomic();
    atom.set(followKey, { createdAt: now });
    atom.set(followerKey, { createdAt: now });
    await atom.commit();
    return c.json({ isFollowing: true, message: 'フォローしました' });
  }
});

/* --- server.ts に追加: 投稿を1つだけ取得する用 --- */
app.get('/api/messages/:id', async (c) => {
  const id = c.req.param('id');

  // 投稿データを取得
  const item = await kv.get(['messages', id]);
  const post = item.value;

  if (!post) {
    return c.json({ message: '投稿が見つかりません' }, 404);
  }

  // 投稿者の情報を取得して名前を表示できるようにする
  const userEntry = await kv.get(['users', post.userId]);
  const userData = userEntry.value;

  return c.json({
    id: post.id,
    userId: post.userId,
    displayName: userData ? userData.displayName : post.userId,
    content: post.content,
    createdAt: post.createdAt
  });
});

// server.ts に追加

/* --- スレッド（親・自分・返信）を取得するAPI --- */
app.get('/api/thread/:id', async (c) => {
  const id = c.req.param('id');

  // 1. 中心となる投稿（自分）を取得
  const targetEntry = await kv.get(['messages', id]);
  const targetPost = targetEntry.value;

  if (!targetPost) {
    return c.json({ message: '投稿が見つかりません' }, 404);
  }

  // ユーザー情報を付与するヘルパー関数
  const enrichPost = async (post) => {
    if (!post) return null;
    const userEntry = await kv.get(['users', post.userId]);
    const userData = userEntry.value;
    return {
      ...post,
      displayName: userData ? userData.displayName || userData.username : post.userId,
      userImage: userData && userData.image ? `/uploads/${userData.image}` : null
    };
  };

  // 2. 「親」を取得（もしあれば）
  let parentPost = null;
  if (targetPost.parentId) {
    const parentEntry = await kv.get(['messages', targetPost.parentId]);
    if (parentEntry.value) {
      parentPost = await enrichPost(parentEntry.value);
    } else {
      // 親が削除されている場合
      parentPost = { content: '削除された投稿', displayName: '不明' };
    }
  }

  // 3. 「子（返信）」を検索
  // (注意: 本格的なアプリではインデックスを作るべきですが、今回は全件スキャンで簡易実装します)
  const replies = [];
  const iter = kv.list({ prefix: ['messages'] });
  for await (const item of iter) {
    const msg = item.value;
    // parentId が 今回の投稿ID と一致するものを探す
    if (msg.parentId === id) {
      const enriched = await enrichPost(msg);
      replies.push(enriched);
    }
  }
  // 古い順に並べる
  replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // 自分の情報もリッチにする
  const enrichedTarget = await enrichPost(targetPost);

  return c.json({
    parent: parentPost,
    target: enrichedTarget,
    replies: replies
  });
});

Deno.serve(app.fetch);
