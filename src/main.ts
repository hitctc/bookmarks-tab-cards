import 'ant-design-vue/dist/reset.css';
import '@/styles/main.css';

import { Button, Divider, Drawer, Form, Input, Select, Spin, TreeSelect } from 'ant-design-vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from '@/App.vue';
import router from '@/router';

function bootstrapApp() {
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  // 只注册用到的组件，避免把整个 antd 打进包里
  app.use(Button);
  app.use(Divider);
  app.use(Drawer);
  app.use(Form);
  app.use(Input);
  app.use(Select);
  app.use(Spin);
  app.use(TreeSelect);
  app.mount('#app');
}

bootstrapApp();


