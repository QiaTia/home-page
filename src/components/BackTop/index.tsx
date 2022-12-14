import { scrollTo } from '@/utils/utils';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import { createRef } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface Props {
  onClick?: (e: MouseEvent) => void;
  className?: string;
  visibilityHeight?: number
}

const prefixCls = 'back-top';

export default function BackTop (prop: Props) {
  const visibilityHeight = prop.visibilityHeight || 400;

  const [visible, setVisible] = useState<boolean>(visibilityHeight === 0);

  const scrollToTop = (e: MouseEvent) => {
    scrollTo(0);
    prop.onClick?.(e);
  };
  const ref = createRef<HTMLDivElement>();
  /** 滚动 */
  function onScrollEvent() {
    const offsetTop = window.document.documentElement.scrollTop || window.document.body.scrollTop;
    setVisible(offsetTop > visibilityHeight);
  }
  useEffect(() => {
    window.addEventListener('scroll', onScrollEvent);
    return () => window.removeEventListener('scroll', onScrollEvent);
  }, []);
  const className = classNames(prefixCls, { visible }, prop.className)
  return <div className={ className }  onClick={scrollToTop} ref={ref}>
    <div className={`${prefixCls}-content flex-algin`}>
      <div className={`${prefixCls}-icon`}>
        <VerticalAlignTopOutlined />
      </div>
    </div>
  </div>
}
