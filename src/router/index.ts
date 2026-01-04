import { createRouter, createWebHashHistory } from 'vue-router';

const NewTabPage = () => import('@/pages/newtab-page.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'newtab',
      component: NewTabPage,
    },
  ],
});

export default router;


