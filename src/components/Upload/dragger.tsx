import type { React } from '@/layout/typings';
import { debounce } from '@/utils/utils';
import { InboxOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import { createRef, forwardRef, HTMLAttributes, RefObject, useState } from "preact/compat";

type BaseDraggerProps = {
  style?: React.Style;
  ref: RefObject<HTMLInputElement>;
  className?: string;
  onFile?: (files: FileList) => void;
  label?: string;
} & HTMLAttributes<HTMLInputElement>

const DROP = 'drop';

function Dragger(props: BaseDraggerProps) {
  const { ref, className, children, style, onFile, ...inputProps } = props;
  const inputRef = ref || createRef<HTMLInputElement>();
  const [ dragState, setDragState ] = useState(DROP);

  function onChange(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if(files) onFile?.(files);
    (e.target as HTMLInputElement).value = '';
  }
  /** 文件拖动 */
  const onFileDrop = (e: DragEvent) => {
    setDragState(e.type);
    if (e.type === DROP && e.dataTransfer?.files) {
      onFile?.(e.dataTransfer.files);
    }
    e.preventDefault();
    debounce(() => setDragState(DROP));
  };
  return (<label
    onDrop={onFileDrop}
    onDragOver={onFileDrop}
    onDragLeave={onFileDrop}
    className={classnames('upload-dragger', className, [ dragState !== DROP && 'active' ])}
    style={style}>
    <input { ...inputProps } onChange={ onChange } type="file" ref={inputRef} />
    { children ? children : <>
      <p className="upload-dragger-icon"><InboxOutlined /></p>
      <p className="upload-dragger-text">{ props.label ?? 'Click or drag file to this area to base64' }</p>
    </> }
  </label>)
}

// @ts-ignore
export default forwardRef<HTMLInputElement, BaseDraggerProps>((props, ref)=> <Dragger { ...props } ref={ref} />);