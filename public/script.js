'use strict';

function Registraapp() {
  return {
    username: '',
    email: '',
    password: '',
    HB: '',
    // form_image: null,
    // count: 0,
    uploadImage: null,
    data: null,
    file: null,
    result: '',
    //ハンバーガーメニュ用
    isOpen: false,

    // /AI
    onFileChange(e) {
      this.file = e.target.files[0];
      this.uploadImage = URL.createObjectURL(this.file);
    },
    //Ai

    //登録
    async submitData() {
      if (!this.file) {
        alert('画像ファイルを選択してください');
        return;
      }
      if (!this.username || !this.email || !this.password || !this.HB || !this.file) {
        alert('すべての項目を入力してください');
        return;
      }
      if (!this.email.includes('@')) {
        alert('メールアドレスを入力してください');
        return;
      }
      const form_Data = new FormData();
      form_Data.append('username', this.username);
      form_Data.append('email', this.email);
      form_Data.append('password', this.password);
      form_Data.append('HB', this.HB);
      form_Data.append('image', this.file);
      form_Data.append('completed', 'false');
      const res = await fetch('/api/new_member', {
        method: 'POST',
        body: form_Data
      });
      const obj = await res.json();
      this.data = obj;
      if (obj.token) {
        localStorage.setItem('jwt', obj.token); // ★キー名は 'jwt' で統一した方が良いです（他の場所で localStorage.jwt を使っているため）
        window.location.href = 'home.html'; //ホーム画面へ移動
      }

      console.log(JSON.stringify(this.data, null, 2));

      this.username = '';
      this.password = '';
      this.email = '';
      this.HB = '';
      this.uploadImage = null;
      this.file = null;
    }, //登録

    //ログイン
    async login_getData() {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password })
      });
      this.data = await res.json();
      this.result = this.data.message;
      console.log(this.data.message);
      if (res.ok) {
        localStorage.jwt = this.data.token; // localStorageに保存
        window.location.href = 'home.html'; //ホーム画面へ移動
      }
    },
    //プロフィールの取得
    async getProfile() {
      // localStorageからトークンを取得
      const token = localStorage.jwt;
      if (!token) {
        this.result = 'ログインしてください';
        return;
      }
      // GETリクエスト
      const res = await fetch('/api/user_info', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.result = 'ログインユーザー：' + data.username;
      } else {
        this.result = 'トークンが異なります';
      }
    },

    /* ログアウト */
    async logout() {
      if (localStorage.jwt) {
        delete localStorage.jwt;
        this.result = 'ログアウトしました';
        window.location.href = 'New_member.html';
      } else {
        this.result = 'ログインしていません';
        window.location.href = 'New_member.html';
      }
    }
  };
}

function HomeApp() {
  return {
    username: '',
    result: '',
    isOpen: false,
    posts: [],
    activeMenuId: null,

    // ★追加: 検索用の変数
    searchKeyword: '', // 入力欄の文字
    filterWord: '', // 検索ボタンを押した確定後の文字

    // ★追加: 現在のタブ ('all' または 'following')
    currentTab: 'all',

    // ★ここから追加
    isThreadOpen: false, // モーダルが開いているか
    threadData: null, // スレッドのデータ
    // スレッドを開く
    async openThread(postId) {
      this.isThreadOpen = true;
      this.threadData = null; // ロード中は空にする

      const token = localStorage.jwt;
      const res = await fetch(`/api/thread/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        this.threadData = await res.json();
      } else {
        alert('スレッドの取得に失敗しました');
        this.isThreadOpen = false;
      }
    },

    // スレッドを閉じる
    closeThread() {
      this.isThreadOpen = false;
      this.threadData = null;
    },

    // ★追加: 画面上部のタイトルを動的に変える
    getTitle() {
      if (this.currentTab === 'private') return '🔒 じぶんだけ';
      if (this.currentTab === 'following') return 'フォロー中';
      return 'タイムライン';
    },

    //返信
    // ★追加: 返信画面へ移動
    goReply(postId) {
      // 現在のタブ情報を維持しつつ、replyToパラメータをつけて移動
      const current = this.currentTab === 'private' ? 'private' : '';
      window.location.href = `Post.html?replyTo=${postId}&mode=${current}`;
    },

    async mounted() {
      await this.getProfile();
      // ★追加: URLの ?tab=... を見て、開くタブを決める
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'private') {
        this.currentTab = 'private';
      } else if (tabParam === 'following') {
        this.currentTab = 'following';
      }
      await this.getPosts();
    },

    // ★追加: タブ切り替え機能
    async switchTab(tabName) {
      if (this.currentTab === tabName) return; // 同じなら何もしない
      this.currentTab = tabName;
      this.posts = []; // 一旦クリアして読み込み中感を出す
      await this.getPosts(); // 新しいタブ条件で再取得
    },
    // 投稿取得 (タブに応じてパラメータを変える)
    async getPosts() {
      const token = localStorage.jwt;
      // クエリパラメータ ?type=following などを付与
      const res = await fetch(`/api/posts?type=${this.currentTab}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.posts = data.messages;
      } else {
        this.result = '投稿の取得に失敗しました';
      }
    },

    // ★ユーザープロフィールへ移動
    goToUser(userId) {
      window.location.href = `profile.html?user=${userId}`;
    },

    // ★追加: 検索ボタンを押したときの処理
    doSearch() {
      this.filterWord = this.searchKeyword; // 入力内容をフィルターに適用
    },

    // ★追加: 絞り込まれた投稿リスト（これを画面に表示する）
    get filteredPosts() {
      // 検索ワードが空なら、全ての投稿を返す
      if (!this.filterWord) {
        return this.posts;
      }

      // 検索ワードを小文字に変換（大文字・小文字を区別しないため）
      const lowerKey = this.filterWord.toLowerCase();

      // ユーザー名(userId) または 本文(content) にキーワードが含まれるものを探す
      return this.posts.filter((post) => {
        const inUser = post.userId && post.userId.toLowerCase().includes(lowerKey);
        const inContent = post.content && post.content.toLowerCase().includes(lowerKey);
        return inUser || inContent;
      });
    },

    //プロフィールの取得
    async getProfile() {
      // localStorageからトークンを取得
      const token = localStorage.jwt;
      // if (token) {
      //   window.location.href = 'profile.html';
      // }
      if (!token) {
        this.result = 'ログインしてください';
        return;
      }
      // GETリクエスト
      const res = await fetch('/api/user_info', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.username = data.displayName; // 表示名を使う
        this.result = 'ユーザー：' + data.displayName;
      } else {
        this.result = 'トークンが異なります';
      }
    },
    // ★追加: メニューの開閉切り替え
    toggleMenu(postId) {
      if (this.activeMenuId === postId) {
        this.activeMenuId = null; // 既に開いていれば閉じる
      } else {
        this.activeMenuId = postId; // その投稿のメニューを開く
      }
    },

    // ★追加: 削除機能
    async deletePost(postId) {
      if (!confirm('本当に削除しますか？')) return;

      const token = localStorage.jwt;
      const res = await fetch(`/api/messages/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // 成功したら画面からも消す
        this.posts = this.posts.filter((p) => p.id !== postId);
        this.activeMenuId = null; // メニューを閉じる
      } else {
        alert('削除に失敗しました');
      }
    },

    goProfile() {
      window.location.href = 'profile.html';
    },
    /* ログアウト */
    async logout() {
      if (localStorage.jwt) {
        delete localStorage.jwt;
        this.result = 'ログアウトしました';
        window.location.href = 'New_member.html';
      } else {
        this.result = 'ログインしていません';
        window.location.href = 'New_member.html';
      }
    },
    //投稿
    async gopost() {
      if (this.currentTab === 'private') {
        window.location.href = 'Post.html?mode=private';
      } else {
        window.location.href = 'Post.html';
      }
      // window.location.href = 'Post.html';
    }
  };
}

/* --- ★プロフィール機能 --- */
function ProfileApp() {
  return {
    displayName: '', // 表示名
    username: '', // 内部ID
    bio: '',
    image: null,
    isMe: false, // 自分のページかどうか
    posts: [], // その人の投稿

    // ★追加: フォロー関連データ
    isFollowing: false,
    followingCount: 0,
    followersCount: 0,

    // 編集用データ
    isEditing: false,
    editName: '',
    editBio: '',
    editFile: null,
    previewImage: null,

    async mounted() {
      await this.loadProfileData();
    },

    async loadProfileData() {
      const token = localStorage.jwt;
      if (!token) {
        window.location.href = 'New_member.html';
        return;
      }

      // URLから ?user=xxx を取得
      const urlParams = new URLSearchParams(window.location.search);
      const targetUser = urlParams.get('user');

      // APIリクエスト（userパラメータがあれば付与）
      let url = '/api/user_info';
      if (targetUser) {
        url += `?user=${targetUser}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        this.displayName = data.displayName;
        this.username = data.username;
        this.bio = data.bio;
        this.image = data.image;
        this.isMe = data.isMe;

        // ★追加: サーバーから受け取ったデータをセット
        this.isFollowing = data.isFollowing;
        this.followingCount = data.followingCount;
        this.followersCount = data.followersCount;

        // その人の投稿を取得
        await this.getUserPosts(data.username);
      } else {
        alert('プロフィールの取得に失敗しました');
      }
    },
    // ★追加: フォロー切り替え処理
    async toggleFollow() {
      const token = localStorage.jwt;
      // APIへPOSTリクエスト
      const res = await fetch(`/api/follow/${this.username}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // 状態を更新
        this.isFollowing = data.isFollowing;

        // カウントの見た目を即座に更新（リロードしなくてもいいように）
        if (this.isFollowing) {
          this.followersCount++;
        } else {
          this.followersCount--;
        }
      } else {
        alert('エラーが発生しました');
      }
    },

    async getUserPosts(targetUserId) {
      const token = localStorage.jwt;
      // 特定のユーザーの投稿だけ取得するAPI呼び出し
      const res = await fetch(`/api/posts?user=${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        this.posts = data.messages;
      }
    },

    /* --- 編集機能 --- */
    startEdit() {
      this.isEditing = true;
      this.editName = this.displayName;
      this.editBio = this.bio;
      this.previewImage = this.image; // 初期値は今の画像
      this.editFile = null;
    },

    cancelEdit() {
      this.isEditing = false;
    },

    onFileChange(e) {
      const file = e.target.files[0];
      if (file) {
        this.editFile = file;
        this.previewImage = URL.createObjectURL(file);
      }
    },

    async saveProfile() {
      const token = localStorage.jwt;
      const formData = new FormData();
      formData.append('displayName', this.editName);
      formData.append('bio', this.editBio);
      if (this.editFile) {
        formData.append('image', this.editFile);
      }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        alert('プロフィールを更新しました');
        this.isEditing = false;
        // 画面をリロードして反映
        location.reload();
      } else {
        alert('更新に失敗しました');
      }
    },

    gohome() {
      window.location.href = 'home.html';
    }
  };
}

//投稿
function PostApp() {
  return {
    postContent: '',
    isPrivate: false, // ★追加: チェックボックスの状態
    parentPost: null, // ★追加: 返信元の投稿データ
    replyToId: null, // ★追加: 返信元のID

    async mounted() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'private') {
        this.isPrivate = true;
      }
      // ★追加: 返信モードかどうかの判定
      const replyTo = params.get('replyTo');
      if (replyTo) {
        this.replyToId = replyTo;
        await this.loadParentPost(replyTo);
      }
    },

    // ★追加: 返信元の投稿情報をサーバーから取得
    async loadParentPost(id) {
      const token = localStorage.jwt;
      const res = await fetch(`/api/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        this.parentPost = await res.json();
      }
    },

    async post() {
      if (!this.postContent) {
        window.alert('投稿内容を入力してください');
        return;
      }
      const token = localStorage.jwt;
      if (!token) {
        window.location.href = 'New_member.html';
        return;
      }

      const visibility = this.isPrivate ? 'private' : 'public';

      const res = await fetch('/api/post_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: this.postContent,
          visibility: visibility,
          parentId: this.replyToId // ★追加: 親IDを送る（なければnull）
        })
      });

      if (!res.ok) {
        window.alert('投稿に失敗しました。');
        return;
      }

      // 投稿後の戻り先処理（前の回答の内容）
      if (this.isPrivate) {
        window.location.href = 'home.html?tab=private';
      } else {
        window.location.href = 'home.html';
      }
    },

    async gohome() {
      window.location.href = 'home.html';
    }
  };
}
