import { render } from 'preact'
import { App } from './views/app'
import './index.less'
import { setTheme } from './utils/utils';

render(<App />, document.body);

/** 设置当前主题 */
setTheme();