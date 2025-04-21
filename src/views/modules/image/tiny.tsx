import Spin from "@/components/Spin";
import Dragger from "@/components/Upload/dragger";
import notify from "@/utils/notify";
import { downFile, formatFileSize } from "@/utils/utils";
import { useEffect, useRef, useState } from "preact/hooks";
import TinyWorker from './worker?worker';
import Button from "@/components/Button";
import './tiny.less';
import Tag from "@/components/Tag";

let Tiny: Worker;

interface FileItem {
  /** 文件名 */
  name: string;
  /** 文件大小 */
  size: number;
  /** 文件类型 */
  type: string;
  /** 原始文件内容 */
  originFile: File;
  /** 压缩后文件内容 */
  compressedFile?: File;
  /** 压缩状态 */
  isCompressed: boolean;
  /** 输出错误内容 */
  errorMsg?: string;
  /** 简单去重的唯一标识 */
  uniqueId: string;
}

function genFileInfo(file: File): FileItem {
  return {
    name: file.name,
    uniqueId: file.type + file.name + file.size,
    size: file.size,
    type: file.type,
    originFile: file,
    isCompressed: false,
  }
}

function TinyImage() {
  const [ fileList, setFileList ] = useState<FileItem[]>([]);
  const [compressedIndex, setCompressedIndex] = useState(-1);
  const [ isDone, setDone ] = useState(false);
  const fileListRef = useRef(fileList);
  /** 选择文件时 */
  function onFile(files: FileList) {
    if(!files[0]?.type.includes('image')) return notify.error('请拖拽图片文件上传!', void 0, 0);
    setFileList(function(list) {
      const newList = [...list, ...Array.from(files).map(genFileInfo)];
      if (!isDone) {
        const item = newList[list.length];
        setCompressedIndex(list.length);
        // 发送压缩请求
        Tiny?.postMessage({ payload: { file: item.originFile, uniqueId: item.uniqueId }});
      }
    // ...
      return newList;
    });
    setDone(true);
  }

  /** 接收到压缩完成事件 */
  function onCompressComplete({ data }: MessageEvent<{ file: File; uniqueId: string }>) {
    const dIndex = fileListRef.current.findIndex((fileInfo) => fileInfo.uniqueId === data.uniqueId);
    if (dIndex === -1) {
      setDone(false);
      setCompressedIndex(-1);
      return;
    }
    const item = fileListRef.current[dIndex];
    item.compressedFile = data.file;
    setFileList([...fileListRef.current]);
    const lastIndex = dIndex + 1;
    if (lastIndex < fileListRef.current.length) {
      const next = fileListRef.current[lastIndex];
      setCompressedIndex(lastIndex);
      Tiny?.postMessage({ payload: { file: next.originFile, uniqueId: next.uniqueId }});
    } else {
      setDone(false);
      setCompressedIndex(-1);
    }
  }

  function onDownload(id: string) {
    const item = fileList.find((fileInfo) => fileInfo.uniqueId === id);
    if (!item) return notify.error('文件不存在', void 0);
    if (!item.compressedFile) return notify.error('文件未压缩完成', void 0);
    downFile(item.compressedFile!);
  }
  useEffect(() => {
    Tiny = new TinyWorker();
    Tiny.onmessage = onCompressComplete;
    return function () {
      Tiny.onmessage = null;
      Tiny.terminate();
    }
  },[]);
  useEffect(function () {
    fileListRef.current = fileList;
  }, [fileList]);
  return (
    <>
      <div className="container flex-algin flex-column" style={{ padding: "60px 0" }}>
        <Spin spinning={isDone}>
          <Dragger accept="image/*" onFile={onFile} style={{ padding: "0 20px" }} />
        </Spin>
      </div>
      <div className="container flex-algin flex-column">
        {
          fileList.map((fileInfo, i) => <FileItem file={fileInfo} isCompressing={i === compressedIndex} onDownload={onDownload} key={fileInfo.uniqueId} />)
        }
      </div>
    </>
  )
}

function FileItem(prop: { file: FileItem; isCompressing?: boolean; onDownload: (id: string) => void }) {
  return (<div className="tiny-item flex-between flex-row">
    <div className="tiny-item__cover">
      <img src={URL.createObjectURL(prop.file.originFile)} alt={prop.file.name} />
    </div>
    <div title={prop.file.name} className="tiny-item__body flex-column flex-auto">
      <h4>{prop.file.name}</h4>
      <p><Tag>{ prop.file.type }</Tag> {formatFileSize(prop.file.size)}</p>
    </div>
    { prop.file.compressedFile ? <div className="flex-column" style={{ paddingRight: '0.8em' }}>
      <p className="fw-600">{ -((prop.file.size - prop.file.compressedFile.size) / prop.file.size * 100).toFixed(2) }%</p>
      <p>{formatFileSize(prop.file.compressedFile.size)}</p>
    </div> : null}
    <Button loading={prop.isCompressing} onClick={() => prop.onDownload(prop.file.uniqueId)}>下载</Button>
  </div>)
}

export default TinyImage;