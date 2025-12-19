'use strict';

function Registraapp() {
  return {
    username: '',
    email: '',
    password: '',
    HB: '',
    form_image: null,
    // count: 0,
    uploadImage: null,
    data: null,
    file: null,

    //オブジェクトとしてにする？

    // /AI
    form_image(e) {
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
      if (!this.username || !this.email || !this.password || !this.HB || !this.form_image) {
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
      // const url = 'https://httpbin.org/post';

      // const res = await fetch(url, {
      const res = await fetch('/api/new_member', {
        method: 'POST',
        body: form_Data
      });
      const obj = await res.json();
      this.data = obj;
      // this.uploadImage = obj.files.image;
      // document.querySelector('img').src = this.uploadImage;
      console.log(JSON.stringify(this.data, null, 2));

      this.username = '';
      this.password = '';
      this.email = '';
      this.HB = '';
      this.form_image = null;
      // this.count = 0;
      this.uploadImage = null;
      // this.data = null;
      this.file = null;
    }
  };
}
//登録

function login_dataset() {
  return {
    data: false,

    async login_getData() {
      const res = await fetch('/api/login');
      this.data = await res.json();
      console.log(this.data.message);
    }
  };
}
