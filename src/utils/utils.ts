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

/** 返回页面顶部 */
export function scrollTo(y = 0) {
  (function smoothscroll() {
    const currentScroll = (document.documentElement.scrollTop || document.body.scrollTop) - y;
    if (currentScroll > y) {
      window.requestAnimationFrame(smoothscroll);
      window.scrollTo(y, currentScroll - currentScroll / 5);
    }
  })();
}

export function downFile(payload: Blob | MediaSource) {
  const downEL = document.createElement('a');
  downEL.setAttribute('download', Math.ceil(Math.random() * 9e9).toString(32).slice(2));
  downEL.setAttribute('href', URL.createObjectURL(payload));
  downEL.click();
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
  return new Promise<void>((resolve, reject) =>{
    // @ts-ignore
    if (window.clipboardData) {
      // @ts-ignore
      window.clipboardData.clearData();
      // @ts-ignore
      clipboardData.setData("Text", text);
      resolve();
    } else if(document.execCommand('copy')) {
      const oInput = document.createElement('input');
      oInput.value = text;
      document.body.appendChild(oInput);
      // oInput.style.display='none'
      oInput.select(); // 选择对象
      document.execCommand("Copy"); // 执行浏览器复制命令
      oInput.remove();
      resolve();
    } else {
      reject();
    }
  })

}
