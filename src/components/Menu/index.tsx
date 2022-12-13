import classNames from "classnames";
import { useEffect, useState } from "preact/hooks";
import { React } from "@/layout/typings";
import { createRef, forwardRef } from 'preact/compat';
import { JSXInternal } from "preact/src/jsx";

export interface PropsItem {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string
}

type OnChangeProps = (index: number, e: JSXInternal.TargetedMouseEvent<HTMLLIElement>) => void

interface MenuProps {
  list: PropsItem[],
  className?: string;
  defaultIndex?: number,
  onChange?: OnChangeProps,
  ref?: any
}

function Menu (props: MenuProps) {
  const [ currentIndex, setIndex ] = useState(props.defaultIndex ?? 0);
  const buttonRef = (props.ref as any) || createRef<HTMLElement>();

  const onTap: OnChangeProps = (i, e) => {
    props.onChange?.(i, e);
    setIndex(i);
  };
  useEffect(() => {
    if(props.defaultIndex !== undefined) setIndex(props.defaultIndex);
  }, [props.defaultIndex])
  return (
    <ul className={classNames('nav-menu', 'flex-row', props.className)} ref={buttonRef}>
      {
        props.list.map((item, i) => <li 
          key={ i } 
          onClick={ (e) => onTap(i, e) }
          className={ classNames('nav-menu-li', [ i == currentIndex && 'active' ]) }
        >{
          typeof item.title == 'string' ? <span>{item.title}</span> : item.title
        }</li>)
      }
    </ul>
  )
}

export default forwardRef<HTMLElement, MenuProps>((props, ref)=> <Menu { ...props } ref={ref} />);