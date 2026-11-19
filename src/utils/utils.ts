import notify from './notify';

interface renderProps {
  oncanplay?: Function,
  onended?: Function,
  onerror?: Function,
  src: string
}

export default function audioPlay(config: any): Promise<any> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return new Promise((resolve, reject) => {
    const currentConfig = { ...config, close, oncanplay, onended, onerror } as renderProps;
    function destroy(...args: any[]) {
      if (div && div.parentNode) {
        div.parentNode.removeChild(div);
      }
      const triggerCancel = args.some(param => param && param.triggerCancel);
      if (config.onError && triggerCancel) {
        config.onError(...args);
      }
    }
    // 准备完毕, 开始播放
    function oncanplay({ target }: { target: HTMLAudioElement }) {
      target.play()
    }

    function onended(e: any) {
      resolve(e)
      destroy(e)
    }

    function onerror(e: any) {
      reject(e)
      destroy(e)
    }

    function render({ oncanplay, onended, onerror, src }: renderProps) {
      /**
       * https://github.com/ant-design/ant-design/issues/23623
       *
       * Sync render blocks React event. Let's make this async.
       */
      setTimeout(() => {
        const audioEle = document.createElement('audio');
        audioEle.setAttribute('src', src);
          audioEle.oncanplay = e => oncanplay?.(e);
          audioEle.onended = e => onended?.(e);
          audioEle.onerror = e => onerror?.(e);
        div.appendChild(audioEle);
      });
    }

    function close(...args: any[]) {
      if (typeof config.afterClose === 'function') {
        config.afterClose()
      }
      destroy(...args)
    }

    render(currentConfig);
  })
}

function tts(tex: string, lang = 'en-US'): Promise<unknown> {
  if(!window.speechSynthesis) {
    notify.error('你的浏览器不支持!');
    return Promise.reject();
  }
  return new Promise((resolve, reject) =>{
    const utter = new SpeechSynthesisUtterance(tex);
    utter.lang = lang;
    utter.onend = resolve;
    utter.onerror = reject;
    utter.rate = 1.25;
    const voices = window.speechSynthesis.getVoices()
      .filter(t => lang.toLocaleLowerCase() == t.lang.toLocaleLowerCase());
    if(voices.length) utter.voice = voices[0];
    window.speechSynthesis.speak(utter);
  })
}

/** 文本转语音 */
export const textToSound = (function () {
  let isPlaying = false;
  return function(tex: string) {
    if(isPlaying) return ;
    isPlaying = true;
    return new Promise((resolve, reject) => {
      tts(tex).then(e =>{
        isPlaying = false
        resolve(e)
      }).catch((e: unknown) =>{
        isPlaying = false
        reject(e)
      })
    })
  }
})();

type ThemeEmun = 'dark'|'light';

/** 主题设置 */
export const setTheme = (function() {
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let currentTheme: ThemeEmun = themeMedia ? 'dark' : 'light';
  return function({ theme = currentTheme, change = false } = {}) {
    if(change){
      currentTheme = currentTheme == 'dark' ? 'light' : 'dark';
      theme = currentTheme;
    }
    document.documentElement.setAttribute('theme', theme);
    return theme;
  }
})();

/** 进行中的平滑滚动动画句柄, 新调用会取消上一次动画 */
let scrollRafId = 0;

/** 平滑滚动到指定纵向位置: 固定时长内完成, 必然收敛, 不会与用户滚动对抗 */
export function scrollTo(y = 0) {
  cancelAnimationFrame(scrollRafId);
  const start = document.documentElement.scrollTop || document.body.scrollTop;
  if (Math.abs(start - y) < 1) {
    window.scrollTo(0, y);
    return;
  }
  const duration = 300;
  const startTime = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - (1 - t) ** 3; // easeOutCubic
    window.scrollTo(0, start + (y - start) * ease);
    if (t < 1) scrollRafId = requestAnimationFrame(step);
  };
  scrollRafId = requestAnimationFrame(step);
}

export function downFile(payload: Blob | MediaSource, name?: string) {
  const url = URL.createObjectURL(payload);
  const type = payload instanceof Blob ? payload.type : '';
  const extMap: Record<string, string> = {
    'image/svg+xml': '.svg',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  const ext = name ? '' : (extMap[type] || (type.startsWith('image/') ? `.${type.split('/')[1] || 'bin'}` : ''));
  const downEL = document.createElement('a');
  downEL.setAttribute('download', name || Math.ceil(Math.random() * 9e9).toString(32).slice(2) + ext);
  downEL.setAttribute('href', url);
  document.body.appendChild(downEL);
  downEL.click();
  downEL.remove();
  // 延迟释放，避免部分浏览器在读取前被回收
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 函数节流 */
export const Throttle = function (time = 500) {
  let t = 0;
  return function (cd: () => any, delay = time) {
    if (t) return ;
    cd();
    t = window.window.setTimeout(() => (t = 0), delay);
  };
};

export const throttle = Throttle();

/** 函数防抖 */
export const Debounce = function (time = 50) {
  let t = 0;
  return function (cd: () => any, delay = time) {
    if (t) clearTimeout(t);
    t = window.setTimeout(() => cd(), delay);
  };
};

export const debounce = Debounce();

class DebounceThrottle {
  private timer = 0;
  private time = 300;
  private isHide = false;
  private lastTime = Date.now();
  constructor(time = 300) {
    this.time = time;
  }
  /** 任务进入 */
  DebounceThrottle(cd: () => any, time = this.time) {
    this.isHide = false;
    const Next = () => {
      cd();
      this.lastTime = Date.now();
    };
    if (this.timer && Date.now() - this.lastTime < time) {
      this.reset();
      this.timer = window.setTimeout(() => {
        if (this.isHide) this.isHide = false;
        else Next();
        this.reset();
      }, time);
      return;
    }
    Next();
    this.timer = window.setTimeout(() => this.reset(), time);
  }
  /** 清楚不执行待执行任务 */
  clear() {
    this.isHide = true;
  }
  /** Reset任务状态 */
  reset() {
    clearTimeout(this.timer);
    this.timer = 0;
  }
}
/** 防抖节流 */
export const ThrottleDebounce = new DebounceThrottle();

export class DebounceClass {
  time = 50;
  timer = 0;
  constructor(time?: number) {
    if(time) this.time = time;
  }
  clear() {
    if(this.timer) clearTimeout(this.timer); 
  }
  enter(cd: () => any, delay = this.time) {
    this.clear();
    this.timer = window.setTimeout(() =>{
      cd();
      this.timer = 0;
    }, delay);
  }
}

/**

 * 将字节大小转换为易读的文件单位（自动适配最大单位）

 * @param {number} bytes - 文件字节大小

 * @param {number} [decimals=2] - 保留小数位数（默认2位）

 * @returns {string} 格式化后的文件大小字符串

 */
export function formatFileSize(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const dm = decimals < 0 ? 0 : decimals;
  
  // 计算适配的单位索引
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(k));
  
  // 处理超大单位情况
  const adjustedIndex = unitIndex >= units.length ? units.length - 1 : unitIndex;
  
  return parseFloat((bytes / Math.pow(k, adjustedIndex)).toFixed(dm)) 

      + ' ' 

      + units[adjustedIndex];
}
/**
 * 添加脚本
 * @param src 脚本地址
 */
export function addScript(src: string) {
  return new Promise<Event>((resolve, reject) =>{
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  })
}

/** 复制文本到剪贴板 */
export function copy2Clipboard(text: string) {
  // 安全上下文优先使用异步剪贴板 API
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise<void>((resolve, reject) => {
    const oInput = document.createElement('textarea');
    oInput.value = text;
    oInput.style.position = 'fixed';
    oInput.style.opacity = '0';
    document.body.appendChild(oInput);
    oInput.select();
    try {
      if (document.execCommand('copy')) resolve();
      else reject(new Error('copy failed'));
    } catch (e) {
      reject(e);
    } finally {
      oInput.remove();
    }
  })
}
/** 获取随机颜色 */
export function getRandomColor() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}
/** 获取随机整数 */
export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
/** 获取格式化时间 */
export function getFormatDate(format = 'yyyy-MM-dd hh:mm:ss', date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return format.replace(/yyyy/g, year.toString())
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/dd/g, day.toString().padStart(2, '0'))
    .replace(/hh/g, hour.toString().padStart(2, '0'))
    .replace(/mm/g, minute.toString().padStart(2, '0'))
    .replace(/ss/g, second.toString().padStart(2, '0'));
}

