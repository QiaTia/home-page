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
    component: () => import('@/views/modules/layout')
  },
  {
    title: '优惠信息',
    path: '/pages/wg',
    component: () => import('@/views/modules/pages/wg')
  },
  {
    title: '张大妈推荐',
    path: '/pages/zdm',
    component: () => import('@/views/modules/pages/zdm')
  },
  {
    title: 'JWT解析',
    path: '/webitem/jwt',
    component: () => import('@/views/modules/jwt')
  },
  {
    title: '地图',
    path: '/webitem/map',
    component: () => import('@/views/modules/pages/map')
  },
  {
    title: '下雪吧',
    path: '/webitem/snow',
    component: () => import('@/views/modules/item/snow')
  }, {
    title: 'Base64',
    path: '/webitem/base64',
    component: () => import('@/views/modules/base64')
  }, {
    title: 'CountDown',
    path: '/webitem/countdown',
    component: () => import('@/views/modules/item/countdown')
  }, {
    title: 'Love Eclipse',
    path: '/webitem/eclipse',
    component: () => import('@/views/modules/item/eclipse')
  }, {
    title: 'Peach - Canvas',
    path: '/webitem/peach',
    component: () => import('@/views/modules/item/peach')
  }, {
    title: 'Snow - Canvas',
    path: '/webitem/canvas-snow',
    component: () => import('@/views/modules/item/canvas-snow')
  }, {
    title: 'Rain - Canvas',
    path: '/webitem/canvas-rain',
    component: () => import('@/views/modules/item/rain')
  }, {
    title: 'Typing - 打字机', 
    path: '/webitem/typing',
    component: () => import('@/views/modules/item/typing')
  }, {
    title: 'TinyImage', 
    path: '/webitem/image/tiny',
    component: () => import('@/views/modules/image/tiny')
  }, {
    title: 'BarCodeImage', 
    path: '/webitem/image/barcode',
    component: () => import('@/views/modules/image/bar_code')
  }
];