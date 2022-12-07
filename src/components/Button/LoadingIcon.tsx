import { LoadingOutlined } from '@ant-design/icons';
import CSSMotion from 'rc-motion';
import { createRef, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export interface LoadingIconProps {
  prefixCls: string;
  existIcon: boolean;
  loading?: boolean | object;
}
const getCollapsedWidth = () => ({ width: 0, opacity: 0, transform: 'scale(0)', marginRight: 0 });
const getRealWidth = (node: HTMLElement) => ({
  width: node.scrollWidth,
  opacity: 1,
  transform: 'scale(1)',
  marginRight: 8
});

const LoadingIcon = ({ prefixCls, loading, existIcon }:LoadingIconProps) => {
  const visible = !!loading;

  if (existIcon) {
    return (
      <span className={`${prefixCls}-loading-icon`}>
        <LoadingOutlined />
      </span>
    );
  }
  const [ style, setStyle ] = useState(getCollapsedWidth());

  const ref = createRef();

  useEffect(() => {
    setStyle(visible ? getRealWidth(ref.current) : getCollapsedWidth());
  }, [ref, visible]);

  return (
    <span className={`${prefixCls}-loading-icon`} style={ style } ref={ref}>
      <LoadingOutlined />
    </span>
  );
};

export default LoadingIcon;