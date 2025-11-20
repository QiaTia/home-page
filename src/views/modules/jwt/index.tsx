import Button from '@/components/Button';
import { useEffect, useState } from "preact/hooks";
import Spin from "@/components/Spin";
import notify from "@/utils/notify";
import Input from '@/components/Input';
import './jwt.less';
import tiaBus, { type defaultBusEvent } from '@/store/bus';

const decoder = new TextDecoder()

export default () => {
  const [ defaultValue, setValue ] = useState<string>(''),
    [preStr, setPreStr] = useState(''),
    [ loading, setLoad ] = useState(false);
  /** 复制到粘贴板 */
  const handleCopy = async () => {
    const temp = handleTo()!;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(temp);
      notify.success("已复制内容到剪辑版!")
    }
    // @ts-ignore
    else if (window.clipboardData){
      // @ts-ignore
      window.clipboardData.clearData();
      // @ts-ignore
      clipboardData.setData("Text", temp);
      notify.success("已复制内容到剪辑版!")
    } else if(document.execCommand('copy')) {
      const oInput = document.createElement('input');
      oInput.value = temp;
      document.body.appendChild(oInput);
      // oInput.style.display='none'
      oInput.select(); // 选择对象
      document.execCommand("Copy"); // 执行浏览器复制命令
      oInput.remove();
      notify.success("已复制内容到剪辑版!")
    } else {
      notify.error(`复制失败, 请手动复制!`)
    }
  }
  /** 输入内容 */
  const handleInput = (e: Event) => {
    setValue((e.target as HTMLInputElement).value);
  }
  /** 处理数据 */
  const handleTo = () => {
    if (defaultValue == '') {
      notify.error('请输入内容!');
      return;
    }
    setLoad(true);
    const list = defaultValue.split('.');
    return nextParse(list[1] ?? list[0]);
  }
  /** 数据处理 */
  function nextParse(payload: string) {
    const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const str = decoder.decode(new Uint8Array(decodedPayload.split('').map(c => c.charCodeAt(0))));
    setPreStr(jsonFormat(str));
    setTimeout(() =>setLoad(false), 300);
    return str;
  }
  function jsonFormat(jsonTemp: string | object): string {
    let json = ''
    try {
      // stringify 时需指定缩进否则不会显示换行。为了防止传入的string没有指定 在此统一执行一遍
      if (typeof jsonTemp != 'string') {
        json = JSON.stringify(jsonTemp, undefined, 2);
      } else {
        json = JSON.stringify(JSON.parse(jsonTemp), undefined, 2)
      }
      let jsonObj = JSON.parse(json);
      if (typeof jsonObj === 'object') {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
          let cls = 'number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'key';
            } else {
              cls = 'string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'boolean';
          } else if (/null/.test(match)) {
            cls = 'null';
          }
          return '<span class="' + cls + '">' + match + '</span>';
        });
      } else {
        return jsonTemp as string;
      }
    } catch (e) {
      return jsonTemp as string;
    }
  }
  function onPate(ev: defaultBusEvent) {
    if (ev.type == 'text') {
      setValue(ev.payload as string);
    } else if(ev.type == 'file') {
      setLoad(true);
    }
  }

  useEffect(() => {
    tiaBus.subscribe(onPate);
      /** 销毁子进程 */
      return () => {
        tiaBus.unsubscribe(onPate);
      }
  }, [])

  return <div className="container flex-algin flex-column" style={{ padding: "60px 0" }}>
    <Spin spinning={ loading } tip="Loading...">
      <div className="base64-wrap">
        <Input.TextArea className="textarea"
          onInput={ handleInput } value={defaultValue}
          placeholder="Input JWT string code!"
          rows={ 10 }
          autoSize={{ minRows: 4, maxRows: 10 }}
        />
        <div className="base64-footer">
          <Button onClick = { () => handleTo() }>Parse</Button>
          <Button disabled={!preStr} onClick = { handleCopy }>Copy Content</Button>
        </div>
        { preStr && <pre class="json-wrap" dangerouslySetInnerHTML={{ __html: preStr }}></pre> }
      </div>
    </Spin>
  </div>
}
