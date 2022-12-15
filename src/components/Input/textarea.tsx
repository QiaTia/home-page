import classNames from "classnames";
import { createRef, RefObject } from "preact";
import { forwardRef, useEffect } from "preact/compat";
import { JSXInternal } from "preact/src/jsx";

type InputProp = {
  autoSize?: Record<'maxRows'|'minRows', number|undefined> | boolean
} & JSXInternal.HTMLAttributes<HTMLTextAreaElement>;

function TextArea (props: InputProp) {
  const { ref, style, className, value, autoSize, ...inputProps } = props;
  const inputRef = (ref || createRef<HTMLTextAreaElement>()) as RefObject<HTMLTextAreaElement>;
  useEffect(()=> {
    // @ts-ignore
    inputRef.current.value = value;
    // console.log(inputRef.current?.rows);
  }, [inputRef, value]);

  return (<div style={style} className={ classNames('el-input textarea', className?.toString())}>
    <textarea { ...inputProps } ref={ inputRef } />
  </div>)
}

export default forwardRef<HTMLTextAreaElement, InputProp>((props, ref) => <TextArea ref={ref} { ...props } />)