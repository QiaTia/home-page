import { useEffect } from "preact/hooks";
import { scrollTo } from '@/utils/utils';

const random = (min:number, max:number):number =>  Math.floor(Math.random() * (max - min + 1) + min);

const position = ():number => random(1, 100);
const delay = ():number=> random(1, 4);
const duration = ():number => random(4, 8);
const name = ():number => random(1, 4);
const timing = ():string=> ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'][random(0, 4)];

interface snowItemProps {
  position?: number,
  delay?: number,
  duration?: number,
  name?: number,
  timing?: string
}

const SnowFlake = ({ position, delay, duration, name, timing }:snowItemProps) => {
  const style = { left: position + 'vw', animationName: 'fall,snow'+name, animationDuration: duration + 's', animationDelay: delay +'s', animationTimingFunction: timing };
  return <div style={ style } className="snow-snowflake" />
}
export default () => {
  useEffect(() => window.scrollTo({ top: 46 }), []);
  return <div className="snow-animation">
    { Array(100).fill(0).map((_, i)=><SnowFlake key={i} position={position()} delay={delay()} duration={duration()} name={name()} timing={timing()} />) }
  </div>
}