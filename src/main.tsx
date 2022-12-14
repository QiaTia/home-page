import { render } from 'preact'
import Layout from './layout/'
import './index.less'
import { setTheme } from './utils/utils';

render(<Layout />, document.body);

/** 设置当前主题 */
setTimeout(() => console.log(setTheme()), 3e3)