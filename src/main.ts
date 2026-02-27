import 'ant-design-vue/dist/reset.css';
import '@/styles/main.css';

import { Button, Divider, Drawer, Form, Input, Modal, Popconfirm, Select, Slider, Spin, Switch, TreeSelect } from 'ant-design-vue';
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
  app.use(Modal);
  app.use(Popconfirm);
  app.use(Select);
  app.use(Slider);
  app.use(Spin);
  app.use(Switch);
  app.use(TreeSelect);
  app.mount('#app');
}

bootstrapApp();
