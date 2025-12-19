// reset_db.js
// サーバーと同じ場所を見る
const kv = await Deno.openKv('./my_database');

console.log('データベースを初期化します...');

// すべてのデータを取得して削除
const entries = kv.list({ prefix: [] });
for await (const entry of entries) {
  await kv.delete(entry.key);
  console.log(`削除しました: ${entry.key}`);
}

console.log('完了：データベースは空になりました。');
