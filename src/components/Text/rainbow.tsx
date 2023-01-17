
interface RainBowProps {
  /** 文本内容 */
  tex: string;
  /** 渐变颜色 */
  colors?: string[];
  /** 动画速度 */
  duration?: number;
}
import './index.less';

export function RainBow ({ tex, duration = 200, colors = ['#32c5ff', '#b620e0', '#f7b500', '#20e050'] }: RainBowProps) {
  const linearGradient = colors.map((item, i) => `${ item } ${ (100 / colors.length) * (i + 1) }%`).join(',');
  return (
    <p style={{ backgroundImage: `linear-gradient(30deg, ${ linearGradient })`, animationDuration: `${duration}s` }} class="gradient-text">{tex}</p>
  )
}
