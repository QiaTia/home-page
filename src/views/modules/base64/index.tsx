import Button from '@/components/Button';
import { useEffect, useState } from "preact/hooks";
import Spin from "@/components/Spin";
import notify from "@/utils/notify";
import Dragger from '@/components/Upload/dragger';
import MyWorker from './worker?worker';
import Input from '@/components/Input';

const worker = new MyWorker();

export default () => {
  const [ defaultValue, setValue ] = useState<string>('')
  const [ loading, setLoad ] = useState<boolean>(false)

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
  const handleInput = (e:any) => {
    console.log(e.target.value);
    setValue(e.target.value)
    // console.log(e.target.value)
  }
  const handleBase64 = () => {
    try{
      const val = window.btoa(defaultValue);
      console.log(val);
      setValue(val);
    } catch {
      notify.error(`解析失败, 请检查你输入的内容!`)
    }
  }
  const handleToString = () => {
    try{
      const val = window.atob(defaultValue)
      setValue(val)
    }catch {
      notify.error(`解析失败, 请检查你输入的内容!`)
    }
  }
  function onFile(files: FileList) {
    const [file] = files;
    if(file.size > 1024 * 1024 * 2) return notify.error('文件体积过大');
    worker.postMessage(file);
    setLoad(true);
  }
  useEffect(function() {
    worker.onmessage = function(ev) {
      setLoad(false);
      console.log('主线程收到数据 ->>');
      setValue(ev.data as string);
    };
    /** 销毁子进程 */
    return () => worker.terminate();
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
          <Button onClick = { handleBase64 }>To Base64</Button>
          <Button onClick = { handleToString }>To String</Button>
          <Button onClick = { handleToString }>To File</Button>
        </div>     
      </div>
    </Spin>
  </div>
}