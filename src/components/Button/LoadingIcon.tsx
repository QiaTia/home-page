import { LoadingOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'preact/hooks';

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
  const [ style, setStyle ] = useState(getCollapsedWidth());

  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setStyle(visible && ref.current ? getRealWidth(ref.current) : getCollapsedWidth());
  }, [visible, existIcon]);

  if (existIcon) {
    return (
      <span className={`${prefixCls}-loading-icon`}>
        <LoadingOutlined />
      </span>
    );
  }

  return (
    <span className={`${prefixCls}-loading-icon`} style={ style } ref={ref}>
      <LoadingOutlined />
    </span>
  );
};

export default LoadingIcon;