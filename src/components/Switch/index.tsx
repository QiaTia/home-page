import type { React } from '@/layout/typings';
import classNames from 'classnames';
import { forwardRef, useEffect, useState } from 'preact/compat';
import { JSXInternal } from 'preact/src/jsx';
import './index.less';

type BaseSwitchProps =  {
  onChange?: (value: boolean) => void;
  defaultValue?: boolean,
  className?: string,
  onNode?: React.ReactNode,
  offNode?: React.ReactNode,
} & JSXInternal.HTMLAttributes<HTMLButtonElement>;

function Switch(props: BaseSwitchProps) {
  const { onClick, onNode, offNode, className, defaultValue, onChange, ...btnProps } = props;
  const [ currentState, setState ] = useState(defaultValue ?? false); 
  function handleTap() {
    setState(!currentState);
    onChange?.(!currentState);
  }
  useEffect(() => setState(defaultValue ?? currentState), [defaultValue]);
  return <button
    data-state={ currentState }
    className={classNames(['btn-switch', className, currentState ? 'on':'off'])}
    onClick={ handleTap } {...btnProps}>
    <span>{ currentState ? onNode : offNode }</span>
  </button>
}

export default forwardRef<HTMLButtonElement, BaseSwitchProps>((props, ref)=> <Switch { ...props } ref={ref} />);
