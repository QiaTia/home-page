import Button from '@/components/Button';
import Input from '@/components/Input';
import { useEffect, useState } from 'preact/hooks';
import notify from '@/utils/notify';
import tiaBus, { type defaultBusEvent } from '@/store/bus';
import './index.less';

export default function () {
  const [value, setValue] = useState('');

  /** 全局粘贴分发: 粘贴文本时填入输入框 */
  function onPaste(ev: defaultBusEvent) {
    if (ev.type == 'text') setValue((ev.payload as string).trim());
  }

  useEffect(() => {
    tiaBus.subscribe(onPaste);
    return () => {
      tiaBus.unsubscribe(onPaste);
    };
  }, []);

  const handleInput = (e: Event) => {
    setValue((e.target as HTMLInputElement).value);
  };
  /** 跳转: 未写协议时补全 http://，且只允许 http/https 协议 */
  const handleGo = () => {
    const temp = value.trim();
    if (!temp) {
      notify.error('请输入地址!');
      return;
    }
    const target = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(temp) ? temp : `http://${temp}`;
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      notify.error('地址格式不正确!');
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      notify.error('仅支持 http / https 地址!');
      return;
    }
    window.location.href = url.href;
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleGo();
  };

  return <div className="container flex-algin flex-column goto-wrap">
    <Input
      value={value}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      placeholder="输入地址或网络协议, 如 qiatia.cn"
    />
    <Button type="primary" className="goto-btn" onClick={handleGo}>Go</Button>
  </div>
}
