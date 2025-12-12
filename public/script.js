'use strict';
import { createApp } from 'https://unpkg.com/petite-vue?module';
const file = document.querySelector('input').files[0];

document.querySelector('button').addEventListener('click', fetchData);

// creatApp({
//   form_email: '',
//   form_pass: '',
//   form_BH: '',
//   form_image: '',
//   async submitData() {
//     if (!this.form_email && !this.form_pass && !this.form_BH && !this.form_image) {
//       alart('すべての項目を入力してください');
//     }
//     if (!this.form_email.includes('@')) {
//       alart('メールアドレスを入力してください');
//     };
//     try{

//     }
//   },

// });
function Registraapp() {
  return {
    form_email: '',
    form_pass: '',
    form_BH: '',
    form_image: null,
    count: 0,

    async submitData() {
      const form_Data = new FormData();
      form_Data.append('userId', this.count);
      form_Data.append('title', 'new_member');
      form_Data.append('new_email', this.form_email);
      form_Data.append('new_pass', this.form_pass);
      form_Data.append('new_BH', this.form_BH);
      // form_Data.append('new_image', this.form_image);
      form_Data.append('image', file);
      form_Data.append('completed', false);
      const url = 'https://httpbin.org/post';
      const res = await fetch(url, {
        method: 'POST',
        body: form_Data
      });
      const obj = await res.json();
      this.data = obj;
      console.log(JSON.stringify(this.data, null, 2));
    }
  };
}

function dataset() {
  const body = new FormData();
  body.append('userId', 1);
  body.append('titele', 'new_member');
  body.append('new_email', 'new_member');
  body.append('new_pass', 'new_member');
  body.append('new_BH', 'new_member');
  body.append('new_image', 'new_member');
  body.append('completed,false');
  return {
    data: false,

    async fetchData() {
      const url = 'https://httpbin.org/post';
      const res = await fetch(url);
      const obj = await res.json();
      this.data = obj;
      console.log(JSON.stringify(this.data, null, 2));
    }
  };
}
