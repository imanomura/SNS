'use strict';

function Registraapp() {
  return {
    form_email: '',
    form_pass: '',
    form_BH: '',
    form_image: null,
    count: 0,
    uploadImage: null,
    data: null,
    file: null,

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
      if (!this.form_email && !this.form_pass && !this.form_BH && !this.form_image) {
        alert('すべての項目を入力してください');
        return;
      }
      if (!this.form_email.includes('@')) {
        alert('メールアドレスを入力してください');
        return;
      }
      const form_Data = new FormData();
      form_Data.append('userId', this.count);
      form_Data.append('title', 'new_member');
      form_Data.append('new_email', this.form_email);
      form_Data.append('new_pass', this.form_pass);
      form_Data.append('new_BH', this.form_BH);
      // form_Data.append('new_image', this.form_image);
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
