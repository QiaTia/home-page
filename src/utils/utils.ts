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

/** 函数节流 */
export const Throttle = function (time = 500) {
  let t = 0;
  return function (cd: () => any, delay = time) {
    if (t) return ;
    cd();
    t = setTimeout(() => (t = 0), delay);
  };
};

export const throttle = Throttle();

/** 函数防抖 */
export const Debounce = function (time = 50) {
  let t = 0;
  return function (cd: () => any, delay = time) {
    if (t) clearTimeout(t);
    t = setTimeout(() => cd(), delay);
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
      this.timer = setTimeout(() => {
        if (this.isHide) this.isHide = false;
        else Next();
        this.reset();
      }, time);
      return;
    }
    Next();
    this.timer = setTimeout(() => this.reset(), time);
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

