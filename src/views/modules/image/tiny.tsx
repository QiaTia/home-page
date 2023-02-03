import Spin from "@/components/Spin";
import Dragger from "@/components/Upload/dragger";
import notify from "@/utils/notify";
import { downFile } from "@/utils/utils";
import { useEffect, useState } from "preact/hooks";
import TinyWorker from './worker?worker';

let Tiny: Worker;

function TinyImage() {
  const [ loading, setLoad ] = useState(false)
  notify({ content: 'hello!', icon: 'load', actions: [{ name: 'hello', onClick: console.log}, { name: 'hello', onClick: console.log}] });
  function onFile(files: FileList) {
    if(!files[0]?.type.includes('image')) return notify.error('请拖拽图片文件!', void 0, 0);
    setLoad(true);
    Tiny?.postMessage({ payload: {file: files[0] }});
  }
  useEffect(() => {
    Tiny = new TinyWorker();
    Tiny.onmessage = (function({ data }: MessageEvent<{ file: File }>) {
      console.log(data.file);
      setLoad(false);
      downFile(data.file);
    });
    return function () {
      Tiny.onmessage = null;
      Tiny.terminate();
    }
  },[]);
  return (
    <div className="container flex-algin flex-column" style={{ padding: "60px 0" }}>
      <Spin spinning={loading}>
        <Dragger accept="image/*" onFile={onFile} style={{ padding: "0 20px" }} />
      </Spin>
    </div>
  )
}

export default TinyImage;