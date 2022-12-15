import Button from '@/components/Button';
import { useEffect, useState } from "preact/hooks";
import Spin from "@/components/Spin";
import notify from "@/utils/notify";
import Dragger from '@/components/Upload/dragger';
import MyWorker from './worker?worker';
import Input from '@/components/Input';

const worker = new MyWorker();

enum WorkerEvent { 
  /** 文件toBase64 */
  ftob ='ftob',
  /** base-64 编码的字符串进行解码。 */
  atob = 'atob',
  /** 可以将一个二进制字符串（例如，将字符串中的每一个字节都视为一个二进制数据字节）编码为 Base64 编码的 ASCII 字符串。 */
  btoa = 'btoa',
  /** Base64 to File */
  btof = 'btof'
}

export default () => {
  const [ defaultValue, setValue ] = useState<string>('')
  const [ loading, setLoad ] = useState<boolean>(false)
  /** 复制到粘贴板 */
  const handleCopy = () => {
    const temp = defaultValue
    // @ts-ignore
    if (window.clipboardData){
      // @ts-ignore
      window.clipboardData.clearData();
      // @ts-ignore
      clipboardData.setData("Text", temp);
      notify.success("已复制内容到剪辑版!")
    }else if(document.execCommand('copy')){
      const oInput = document.createElement('input');
      oInput.value = temp;
      document.body.appendChild(oInput);
      // oInput.style.display='none'
      oInput.select(); // 选择对象
      document.execCommand("Copy"); // 执行浏览器复制命令
      oInput.remove();
      notify.success("已复制内容到剪辑版!")
    }else{
      notify.error(`复制失败, 请手动复制!`)
    }
  }
  /** 输入内容 */
  const handleInput = (e: Event) => {
    setValue((e.target as HTMLInputElement).value);
  }
  /** 处理数据 */
  const handleTo = (payload: string, event: WorkerEvent = WorkerEvent.btoa) => {
    setLoad(true);
    worker.postMessage({ payload, event });
  }
  function onFile(files: FileList) {
    const [file] = files;
    setLoad(true);
    worker.postMessage({ payload: file, event: WorkerEvent.ftob });
  }
  useEffect(function() {
    worker.onmessage = function(ev) {
      const { event, payload, error } = ev.data as { payload: unknown, event: WorkerEvent; error: any };
      setLoad(false);
      if(error) {
        console.log(error);
        notify.error(typeof error == 'string' ? error : `解析失败, 请检查输入的内容!`)
        return error;
      }
      console.log(ev.data);
      switch(event) {
        case WorkerEvent.ftob:
        case WorkerEvent.btoa: 
        case WorkerEvent.atob:
          setValue(payload as string);
          break;
        case WorkerEvent.btof: {
          if(ev.data.notify) notify(ev.data.notify);
          const downEL = document.createElement('a');
          downEL.setAttribute('download', Math.ceil(Math.random() * 9e9).toString(32).slice(2));
          downEL.setAttribute('href', URL.createObjectURL(payload as Blob));
          downEL.click();
          console.log(payload);
          break;
        }
      }
    };
    /** 销毁子进程 */
    return () => worker.onmessage = null;
  }, []);

  return <div className="container flex-algin flex-column" style={{ padding: "60px 0" }}>
    <Spin spinning={ loading } tip="Loading...">
      <Dragger onFile={onFile} style={{ padding: "0 20px" }} />
    </Spin>
    <Spin spinning={ loading } tip="Loading...">
      <div className="base64-wrap">
        <Input.TextArea className="textarea"
          onInput={ handleInput } value={defaultValue}
          placeholder="Input base64 code to string"
          rows={ 10 }
          autoSize={{ minRows: 4, maxRows: 10 }}
        />
        <div className="base64-footer">
          <Button onClick = { handleCopy }>Copy Content</Button>
          <Button onClick = { () => handleTo(defaultValue) }>To Base64</Button>
          <Button onClick = { () => handleTo(defaultValue, WorkerEvent.atob) }>To String</Button>
          <Button onClick = { () => handleTo(defaultValue, WorkerEvent.btof) }>To File</Button>
        </div>     
      </div>
    </Spin>
  </div>
}