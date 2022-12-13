import Button from '@/components/Button/index';
import Spin from '@/components/Spin/index';
import { useState } from 'preact/hooks';
/** 懒加载数据 */
import './layout.less';

export default function () {
  const [isLoading, setSpinning] = useState(true);
  return <div className="container">
    <Spin spinning={isLoading} tip='hello'>
      <div style={{ height: 200 }}>hello!</div>
    </Spin>
    <div style={{ width: 200 }} className="flex-between">
      <Button loading={isLoading} onClick={() => setSpinning(true) }>On</Button>
      <Button loading={!isLoading} onClick={() => setSpinning(false) }>Off</Button>
    </div>
  </div>
}