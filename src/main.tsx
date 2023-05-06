import { render } from 'preact'
import Layout from './layout/'
import './index.less'

render(<Layout />, document.body);


// if(window.document.body.offsetWidth > 450) {
//   setTimeout(() => {
//     const script = document.createElement('script');
//     script.src = "https://i.qiatia.cn/public/tia-player/tia-player.mini.js";
//     const script1 = document.createElement('script');
//     script1.innerHTML = '$Tia(6855874492);';
//     document.body.appendChild(script);
//     script.onload = function () {
//       document.body.appendChild(script1);
//     };
//   }, 1e3);
// }
