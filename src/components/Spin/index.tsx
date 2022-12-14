import { DebounceClass } from "@/utils/utils";
import classNames from "classnames";
import { useEffect, useState } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";
import { React } from "@/layout/typings";

type SizeEnum = 'default'|'small'|'large'


interface SpinProps { 
  style?: JSXInternal.CSSProperties, 
  size?: SizeEnum,
  spinning?: boolean;
  tip?: React.ReactNode;
  delay?: number;
  wrapperClassName?: string;
  children?: React.ReactNode;
  className?: string
}

export interface SpinClassProps extends SpinProps {
  hashId?: string;
}

const prefixCls = 'spin';

function shouldDelay(spinning?: boolean, delay?: number): boolean {
  return !!spinning && !!delay && !isNaN(Number(delay));
}

export default (props: SpinClassProps) => {
  const {
    spinning: customSpinning = true,
    delay = 300,
    className,
    size = 'default',
    tip,
    wrapperClassName,
    style,
    children,
    hashId,
  } = props;
  const debounce = new DebounceClass();
  const [spinning, setSpinning] = useState<boolean>(
    () => customSpinning && !shouldDelay(customSpinning, delay),
  );
  const dotClassName = `${prefixCls}-dot`;

  const spinClassName = classNames(
    prefixCls,
    {
      [`${prefixCls}-sm`]: size === 'small',
        [`${prefixCls}-lg`]: size === 'large',
      [`${prefixCls}-spinning`]: spinning,
      [`${prefixCls}-show-text`]: !!tip,
    },
    className,
    hashId,
  );
  const spinElement = (
    <div 
      style={style}
      className={spinClassName}
      aria-live="polite"
      aria-busy={spinning}>
      <div className={`${dotClassName} ${dotClassName}-spin`}>
      {
        Array(4).fill(0)
          .map(() =><span className={ dotClassName + '-item' } />)
      }
    </div>
      {tip ? <div className={`${prefixCls}-text`}>{tip}</div> : null}
    </div>
    
  );
  useEffect(() => {
    if(customSpinning) setSpinning(customSpinning);
    else debounce.enter(() => setSpinning(customSpinning), delay);
    return () => {
      debounce?.clear();
    };
  }, [delay, customSpinning]);

  const isNestedPattern = () => typeof children !== 'undefined';
  if(isNestedPattern()) {
    const containerClassName = classNames(`${prefixCls}-container`, {[`${prefixCls}-blur`]: spinning });
    return (
      <div className={classNames(`${prefixCls}-nested-loading`, wrapperClassName, hashId)}>
        {spinning && <div key="loading">{spinElement}</div>}
        <div className={containerClassName} key="container">
          { children }
        </div>
      </div>
    )
  }
  return spinElement
};
