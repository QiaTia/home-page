import Home from '@/views/home';
// import Layout from '@/views/modules/layout';

export default [
  {
    title: 'QiaTia`小站',
    path: '/',
    component: Home
  },
  {
    title: '小项目',
    path: '/webitem',
    component: import('@/views/modules/layout')
  },
  {
    title: '优惠信息',
    path: '/webitem/pages/wg',
    component: import('@/views/modules/pages/wg')
  },
  {
    title: '张大妈推荐',
    path: '/webitem/pages/zdm',
    component: import('@/views/modules/pages/zdm')
  },
  {
    title: '下雪吧',
    path: '/webitem/snow',
    component: import('@/views/modules/item/snow')
  }, {
    title: 'Base64',
    path: '/webitem/base64',
    component: import('@/views/modules/base64')
  }
];