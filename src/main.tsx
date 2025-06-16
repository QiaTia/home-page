import { render } from 'preact'
import Layout from './layout/'
import './index.less'
import { addScript } from './utils/utils';

render(<Layout />, document.body);


if(window.document.body.offsetWidth > 450) {
  setTimeout(() => {
    addScript('https://tia.nos-eastchina1.126.net/public/tia-player/tia-player.mini.js')
      .then(() => {
      // @ts-ignore
        window.$Tia(6855874492);
      });
  }, 500);
}
