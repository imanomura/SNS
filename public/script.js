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
      // const file = document.querySelector('input').files[0];
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
      const res = await fetch('/api/profile', {
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
    async mounted() {
      await this.getProfile();
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
      const res = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.result = 'ユーザー：' + data.username;
        // this.username = data.username;
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
    },
    //投稿
    async gopost() {
      window.location.href = 'Post.html';
    }
  };
}

function PostApp() {
  return {
    postContent: '',
    async mounted() {}
  };
}
