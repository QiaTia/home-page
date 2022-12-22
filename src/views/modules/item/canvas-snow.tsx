import { createRef, useEffect } from "preact/compat";

type RandomFn = (x: number, y: number) => number;

function getRandom(option: 'x' | 'y' | 'r' | 'fnx' | 'fny') {
  let ret: number | RandomFn, random: number;
  switch (option) {
    case 'x':
      ret = Math.random() * window.innerWidth;
      break;
    case 'y':
      ret = Math.random() * window.innerHeight;
      break;
    case 'r':
      ret = 2 + (Math.random() * 6);
      break;
    case 'fnx':
      random = 27 + Math.random() * 100;
      ret = function (x, y) {
        return x + 0.5 * Math.sin(y / random);
      };
      break;
    case 'fny':
      random = 0.4 + Math.random() * 1.4
      ret = function (x, y) {
        return y + random;
      };
      break;
  }
  return ret;
}

class Snow {
  x: number;
  y: number;
  r: number;
  fn: Record<'x'|'y', RandomFn>;
  constructor(x: number, y: number, radius: number, fn: Record<'x'|'y', RandomFn>) {
    this.x = x;
    this.y = y;
    this.r = radius;
    this.fn = fn;
  }
  draw(cxt: CanvasRenderingContext2D) {
    var grd = cxt.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    grd.addColorStop(.5, "rgba(255, 255, 255, 0.5)");
    grd.addColorStop(1, "rgba(255, 255, 255, 0)");
    cxt.fillStyle = grd;
    cxt.fillRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
  }
  update() {
    this.x = this.fn.x(this.x, this.y);
    this.y = this.fn.y(this.y, this.y);

    if (this.x > window.innerWidth ||
      this.x < 0 ||
      this.y > window.innerHeight ||
      this.y < 0
    ) {
      this.x = getRandom('x') as number;
      this.y = 0;
    }
  }
}

class SnowList {
  list: Snow[] = [];
  push(snow: Snow) {
    this.list.push(snow);
  }
  update () {
    for (let i = 0, len = this.list.length; i < len; i++) {
      this.list[i].update();
    }
  }
  draw (cxt: CanvasRenderingContext2D) {
    for (var i = 0, len = this.list.length; i < len; i++) {
      this.list[i].draw(cxt);
    }
  }
  get (i: number) {
    return this.list[i];
  }
}
let stop: number;

function startSnow(canvas: HTMLCanvasElement) {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
  const cxt = canvas.getContext('2d')!;
  // Create snow objects
  const snowList = new SnowList();
  for (let i = 0; i < 200; i++) {
      let randomX = getRandom('x') as number,
      randomY = getRandom('y') as number,
      randomR = getRandom('r') as number,
      randomFnx = getRandom('fnx') as RandomFn,
      randomFny = getRandom('fny') as RandomFn,
      snow = new Snow(randomX, randomY, randomR, {
          x: randomFnx,
          y: randomFny
      });
      snow.draw(cxt);
      snowList.push(snow);
  }
  function selfBack() {
    cxt.clearRect(0, 0, canvas.width, canvas.height);
    snowList.update();
    snowList.draw(cxt);
    stop = window.requestAnimationFrame(selfBack);
  }
  // Update snow position data, and redraw them in each frame
  stop = requestAnimationFrame(selfBack);
}

export default function CanvasSnow() {
  const canvasRef = createRef<HTMLCanvasElement>();
  useEffect(() => {
    if (canvasRef.current) {
      startSnow(canvasRef.current);
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
    }
  }, [canvasRef]);
  return <div style="background-color: #242424" className="home-page">
    <canvas style="position: fixed;left: 0;top: 0;pointer-events: none;" ref={canvasRef} />
  </div>
}