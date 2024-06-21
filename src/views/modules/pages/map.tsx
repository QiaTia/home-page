import { APILoader } from '@uiw/react-amap-api-loader';
import { useMapContext, useMap, Provider }from '@uiw/react-amap-map';
import { useEffect, useImperativeHandle, useRef, useState } from 'preact/hooks';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { ForwardedRef, forwardRef } from 'preact/compat';
import notify from '@/utils/notify';

type CustomMapForwardRef = { map?: AMap.Map, setPosition(position: [lng: number, lat: number]): void }

let marker: AMap.Marker | null;

function CustomMapForward(_: {}, ref: ForwardedRef<CustomMapForwardRef>) {
  const warpper = useRef(null);
  const { map, state } = useMapContext(),
    { setContainer } = useMap({
      container: warpper.current,
      zoom: 14,
      mapStyle: "amap://styles/whitesmoke", //设置地图的显示样式
    });
  useEffect(() => {
    if (map) {
      handleMove();
      // 创建点标记
      map.on('dragend', handleMove);
      map.on('zoomend', handleMove);
    }
  }, [map]);
  /** 地图移动 */
  function handleMove() {
    if (map) {
      const position = map.getCenter();
      if (marker) map.remove(marker);
      marker = new AMap.Marker({ position });
      map.add(marker);
    }
  }
  /** 设置中心店坐标 */
  function setPosition(position: [lng: number, lat: number]) {
    if (map) {
      map.setCenter(position);
      setTimeout(() => handleMove(), 1e3);
    }
  }
  
  useEffect(() => {
    if (warpper.current) {
      setContainer(warpper.current);
    }
  }, [warpper.current]);
  useImperativeHandle(ref, () => ({ map, setPosition }));
  return <div ref={warpper} style={{ height: 500, width: '100%', borderRadius: 8 }} />;
}

const CustomMap = forwardRef<CustomMapForwardRef>(CustomMapForward);

function Mount() {
  const mapRef = useRef<CustomMapForwardRef>(),
    [inputVal, setValue] = useState('');
  function getCenter() {
    const current = mapRef.current?.map?.getCenter();
    if (current) setValue([current.lng, current.lat].join(','))
  }
  function setPosition() {
    const [lng, lat] = inputVal.split(',').map(Number);
    if (!lng || !lat) return notify.error('坐标可能有误!');
    mapRef.current?.setPosition([lng, lat]);
  }
  return (
    <div className="container flex-algin flex-column" style={{ padding: '60px 0' }}>
      <APILoader version="2.0.5" akey="6df6a5962c7495f617467bf181d19ccf">
        <Provider>
          <CustomMap ref={mapRef} />
        </Provider>
      </APILoader>
      <div style={{ marginTop: 16 }} className="flex-row">
        <Input value={inputVal} onChange={(e) => setValue((e.target as any).value)} placeholder="请输入坐标地址, 比如 116.397428,39.90923" />
        <Button style={{ marginLeft: 8 }} onClick={setPosition}>解析</Button>
        <Button style={{ marginLeft: 8 }} onClick={getCenter}>获取中心坐标</Button>
      </div>
    </div>
  )
}
export default Mount