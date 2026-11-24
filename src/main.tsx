import { render } from 'preact'
import Layout from './layout/'
import './index.less'

render(<Layout />, document.body);

// 生产环境注册 Service Worker, 缓存带 hash 的静态资源以提升回访速度
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // 注册失败不影响正常使用
      });
  });
}
