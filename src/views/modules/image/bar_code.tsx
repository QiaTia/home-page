import Button from "@/components/Button";
import Input from "@/components/Input";
import Spin from "@/components/Spin";
import Dragger from "@/components/Upload/dragger";
import tiaBus, { defaultBusEvent } from "@/store/bus";
import { useEffect, useState } from "preact/hooks"
import './tiny.less';
import { writeBarcode, type WriterOptions } from "zxing-wasm/writer";
import notify from "@/utils/notify";
const writerOptions: WriterOptions = {
  format: "QRCode",
  scale: 3,
};


function barCode() {
  const [ defaultValue, setValue ] = useState<string>('')
  const [ loading, setLoad ] = useState(false);
  const [imgUrl, setImgUrl] = useState<string>('');
  /** 输入内容 */
  const handleInput = (e: Event) => {
    setValue((e.target as HTMLInputElement).value);
  }
  /** 文件 */
  function onFile(files: FileList | File[]) {
    /**  */
  }
  /** 复制 */
  async function handleCopy() {
    if (!defaultValue) {
      notify.error("请输入内容!");
      return;
    }
    setLoad(true);
    const writeOutput = await writeBarcode(defaultValue, writerOptions);
    setImgUrl(window.btoa(writeOutput.svg));
    setLoad(false);
  }
  /** 粘贴时 */
  function onPate(ev: defaultBusEvent) {
    if (ev.type == 'text') {
      setValue(ev.payload as string);
    } else if(ev.type == 'file') {
      onFile([ev.payload as File])
    }
  }
  useEffect(() => { 
    tiaBus.subscribe(onPate);
    return function () {
      tiaBus.unsubscribe(onPate);
    }
  }, []);
  return (<div className="container flex-column" style={{ padding: "60px 0" }}>
    <div className="flex-algin flex-layout" style={{ gap: 24 }}>
      {/* <Spin spinning={ loading } tip="Loading...">
        <Dragger onFile={onFile} style={{ padding: "0 20px" }} />
      </Spin> */}
      <Spin spinning={ loading } tip="Loading...">
        <div className="base64-wrap">
          <Input.TextArea className="textarea"
            onInput={ handleInput }
            value={defaultValue}
            placeholder="Input base64 code to string"
            rows={ 10 }
            autoSize={{ minRows: 4, maxRows: 10 }}
          />   
        </div>
      </Spin>
      { imgUrl ? <div className="flex-algin">
        <img style={{ maxWidth: '48vw', minWidth: 200 }} src={ 'data:image/svg+xml;base64,' + imgUrl } alt="base64" />
      </div> : null}
    </div>
    <div style={{ marginTop: '3em' }} className="base64-footer">
      <Button onClick={ handleCopy }>String To QcImage</Button>
    </div>    
  </div>)
}

export default barCode;
