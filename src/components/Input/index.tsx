import classNames from "classnames";
import { createRef } from "preact";
import { forwardRef } from "preact/compat";
import { JSXInternal } from "preact/src/jsx";
import TextArea from './textarea';

type InputProp = { } & JSXInternal.HTMLAttributes<HTMLInputElement>;
function InternalInput (props: InputProp) {
  const { ref, style, className, ...inputProps } = props;
  const inputRef = ref || createRef<HTMLInputElement>();
  return (<div style={style} className={ classNames('el-input', className?.toString())}>
    <input { ...inputProps } ref={ inputRef } />
  </div>)
}

type InternalUploadType = typeof InternalInput;
type CompoundedComponent = InternalUploadType & {
  /** 文本域 */
  TextArea: typeof TextArea;
  /** 没啥用的东西 */
  LIST_IGNORE: string;
};

/** 普通输入框 */
const Input = forwardRef<HTMLInputElement, InputProp>((props, ref) => <InternalInput ref={ref} { ...props } />) as CompoundedComponent;

Input.TextArea = TextArea;
Input.LIST_IGNORE = '';

export default Input;