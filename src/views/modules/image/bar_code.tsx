import Button from "@/components/Button";
import Input from "@/components/Input";
import Spin from "@/components/Spin";
import Dragger from "@/components/Upload/dragger";
import tiaBus, { defaultBusEvent } from "@/store/bus";
import { useEffect, useState } from "preact/hooks"
import './tiny.less';
import { writeBarcode, type WriterOptions, readBarcodes, type ReaderOptions  } from "zxing-wasm";
import notify from "@/utils/notify";
import { copy2Clipboard } from "@/utils/utils";
// import { addScript } from "@/utils/utils";

const writerOptions: WriterOptions = {
  format: "QRCode",
  scale: 3,
};
const readerOptions: ReaderOptions = {
  tryHarder: true,
  formats: ["QRCode"],
  maxNumberOfSymbols: 1,
};

// zxing-wasm 3.x 默认按自身版本从 CDN 拉取 wasm，无需手动覆盖 locateFile

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
    const file = files[0];
    if(!file.type.includes('image')) return notify.error('请拖拽图片文件上传!', void 0, 0);
    setLoad(true);
    readBarcodes(file, readerOptions)
      .then((result) => {
        if (result.length > 0) {
          setValue(result[0].text);
        } else {
          notify.error("No barcode found!");
        }
      })
      .finally(() => {
        setLoad(false);
      });
  }
  /** 复制 */
  function handleCopy() {
    if (!defaultValue) {
      notify.error("请输入内容!");
      return;
    }
    copy2Clipboard(defaultValue)
      .then(() => notify.success("复制成功!"));
  }

  async function handle2Image() {
    if (!defaultValue) {
      notify.error("请输入内容!");
      return;
    }
    setLoad(true);
    try {
      const writeOutput = await writeBarcode(defaultValue, writerOptions);
      // 用 URL 编码而非 btoa，避免 SVG 含非 Latin-1 字符时抛异常
      setImgUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(writeOutput.svg)}`);
    } catch {
      notify.error("生成二维码失败!");
    } finally {
      setLoad(false);
    }
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
  return (<Spin spinning={loading} tip="Loading...">
    <div className="container flex-column" style={{ gap: 20, padding: "60px 0" }}>
      <Dragger accept="image/*" label="Click or drag file to this area to." onFile={onFile} style={{ padding: "0 20px" }} />
      <div className="flex-algin flex-layout" style={{ gap: 24 }}>
        <Spin spinning={false}>
          <div className="base64-wrap">
            <Input.TextArea className="textarea"
              onInput={ handleInput }
              value={defaultValue}
              placeholder="Input QC code content!"
              rows={ 10 }
              autoSize={{ minRows: 4, maxRows: 10 }}
            />   
          </div>
        </Spin>
        { imgUrl ? <div className="flex-algin">
          <img style={{ maxWidth: '48vw', minWidth: 200 }} src={ imgUrl } alt="base64" />
        </div> : null}
      </div>
      <div className="flex-center" style={{ gap: 8 }}>
        <Button onClick = { handleCopy }>Copy Content</Button>
        <Button onClick={ handle2Image }>String To QC Image</Button>
      </div>    
    </div>
  </Spin>)
}

export default barCode;
