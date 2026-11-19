import { createRef, useEffect } from "preact/compat";


function random(min: number, max: number) {
  return Math.random()*(max-min)+min;
}

class Rain {
  x?: number;
  y?: number;
  v?: number;
  h?: number;
  r?: number;
  vr?: number;
  a?: number;
  va?: number;
  constructor() {
    this.init();
  }
  init() {
    const h = window.innerHeight;
    this.x= random(0, window.innerWidth);
    this.y=0;
    this.v = random(4,5);//随机移动参数
    this.h = random(0.8 * h,0.9 * h);
    this.r=1;
    this.vr=random(1,2);
    this.a=1;
    this.va=0.96;
  }
  draw (ctx: CanvasRenderingContext2D) {
    if(this.y! < this.h!){
      ctx.fillStyle="#33ffff";
      ctx.fillRect(this.x!, this.y!, 2, 10);
    }else{
      ctx.strokeStyle="rgba(0,255,255,"+this.a+")";
      ctx.beginPath();
      ctx.arc(this.x!, this.y!, this.r!, 0, Math.PI*2);   //x,y,r,绘制起始点,绘制终点园
      ctx.stroke();
    }
  }
  move(ctx: CanvasRenderingContext2D){
      if(this.y! < this.h!){
          this.y!+=this.v!; //移动
      } else{
          if(this.a!>0.02){
            this.r!+=this.vr!;
            this.a!*=this.va!;
          }
          else{
            this.init();
          }
      }
      this.draw(ctx);
  }
};

class RainList {
  list: Rain[] = [];
  ctx: CanvasRenderingContext2D;
  /** 逐个生成雨滴的定时器, 组件卸载时需要清理 */
  private timers: number[] = [];
  private destroyed = false;
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    for (let i = 0; i < 150; i++) {
      this.timers.push(window.setTimeout(() => this.createRain(), 200*i));
    }
  }
  createRain(){
    if (this.destroyed) return;
    const rain = new Rain();
    rain.draw(this.ctx);
    this.list.push(rain);
  }
  moveRain(){
    // 半透明填充形成拖尾, alpha 需在 0~1 之间
    this.ctx.fillStyle = "rgba(0,0,0,0.1)";
    this.ctx.fillRect(0,0, window.innerWidth, window.innerHeight);
    for (let k = 0, len = this.list.length; k < len; k++) {
      this.list[k].move(this.ctx);
    }
  }
  destroy() {
    this.destroyed = true;
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
    this.list = [];
  }
}
let stop: number;

function startRain (canvas: HTMLCanvasElement) {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
  const cxt = canvas.getContext('2d')!;
  const sakuraList = new RainList(cxt);
  function selfBack() {
    sakuraList.moveRain();
    stop = window.requestAnimationFrame(selfBack);
  }
  selfBack();
  return sakuraList;
}

export default function CanvasSnow() {
  const canvasRef = createRef<HTMLCanvasElement>();
  useEffect(() => {
    let rainList: RainList | undefined;
    if (canvasRef.current) {
      rainList = startRain(canvasRef.current);
    }
    window.scrollTo({ top: 46 });
    window.onresize = function onResize() {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    return function () {
      window.onresize = null;
      window.cancelAnimationFrame(stop);
      rainList?.destroy();
    }
  }, [canvasRef]);
  return <div style="background-color: #242424" className="home-page">
    <canvas style="width: 100%;height: 100%; pointer-events: none;" ref={canvasRef} />
  </div>
}