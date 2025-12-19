// check_db.js
// const kv = await Deno.openKv();
// プロジェクトフォルダ内に 'my_database' というファイルを作って保存するよう指定
const kv = await Deno.openKv('./my_database');

console.log('=== 登録されているユーザー一覧 ===');

// 'users' というキーで始まるデータを全部持ってくる
const entries = kv.list({ prefix: ['users'] });

for await (const entry of entries) {
  console.log('-------------------------');
  console.log('キー:', entry.key);
  console.log('中身:', entry.value);
}

console.log('-------------------------');
console.log('確認終了');
