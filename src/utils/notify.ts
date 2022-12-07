import * as Icons from './icon';

type IconEmum = 'error' | 'sucess'| 'warn' | 'info' | 'right' | 'left' | 'menu' | 'load';

interface NotifyOption {
  title: string;
  content: string;
  icon: IconEmum;
  duration: number;
}
const prefixCls = 'notify';

const $dom = document.createElement("div");
$dom.className = prefixCls + '-container';

class Notify {
  $:HTMLDivElement;
  _CB: any[];
  Dom?: HTMLDivElement;
  _hide = false;
  $pro_dom?: HTMLDivElement;
  /** 全局Notify方法 */
  constructor() {
    this.$ = $dom;
    this._CB = [];
    if(!isHave($dom, document.body.childNodes)) document.body.appendChild($dom);
  }
  create({ title = "提示", content = '', icon, duration = 4500 }: Partial<NotifyOption>) {
    const NotifyDom = document.createElement("div");
    NotifyDom.className = prefixCls + '-wrap ' + (icon || '');
    // <div class="notify-wrap ${icon}">
    // @ts-ignore
    const iconEl = icon ? `<i class="icon">${Icons[icon]}</i>` : '';
    NotifyDom.innerHTML = `${iconEl}<div class="${prefixCls}-content"><h3 class="${prefixCls}-title">${title}</h3><div class="${prefixCls}-msg">${content}</div></div><button class="${prefixCls}-btn">${Icons['error']}</button><div class="${prefixCls}-progress-bar"></div>`
    this.$.append(NotifyDom);
    this.Dom = NotifyDom;
    // 点击回调
    (NotifyDom.getElementsByClassName(prefixCls + '-btn')[0] as HTMLDivElement).onclick = (e: Event) =>{
      this.hide()
      let cb
      while(cb = this._CB.shift()) cb(e)
    }
    this._hide = false
    this.$pro_dom = NotifyDom.getElementsByClassName(prefixCls+'-progress-bar')[0] as HTMLDivElement;
    setTimeout(()=> NotifyDom.style.transform = "translateX(0)", 99);
    duration && setTimeout(() => this.hide(), duration);
    return this;
  }
  hide() {
    if(this._hide) return false;
    if(this.Dom) {
      this.Dom.style.transform = "translateX(120%)";
      setTimeout(() =>( this.$.removeChild(this.Dom!)), 300);
    }
    this._hide = true;
    return this;
  }
  onProgress(w: number) {
    if(this, this.$pro_dom) this.$pro_dom.style.width = w + "%";
    return this;
  }
  then(Fn: (value: unknown)=>void){
    this._CB.push(Fn)
    return this
  }
}

function isHave(node: HTMLElement, list: NodeListOf<ChildNode>) {
  const len = list.length;
  for(let i =0; i < len; i++) {
    if(node.nodeType == list[i].nodeType && node.className == (list[i] as HTMLElement).className) return true;
  }
  return false;
}

const notify = (content: string | Partial<NotifyOption>, title?: string, icon?: IconEmum, duration?: number) => {
  let data: Partial<NotifyOption> = { title, icon, duration }
  if(typeof content == 'string')  data['content'] = content
  else if(typeof content == 'object') data = { ...data, ...content }
  else return Promise.reject("Option Error!")
  return new Notify().create(data);
}
notify.info = (content: string, title?: string, duration = 0) => notify({ content, title, icon: 'info', duration });

notify.load = (content: string, title?: string, duration = 0) => notify({ content, title, icon: 'load', duration });

notify.warn = (content: string, title?: string, duration?: number) => notify({ content, title, icon: 'warn', duration });

notify.error = (content: string, title?: string, duration?: number) => notify({ content, title, icon: 'error', duration });

notify.sucess = (content: string, title?: string, duration?: number) => notify({ content, title, icon: "sucess", duration });

export default notify;