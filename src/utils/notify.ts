import * as Icons from './icon';

type IconEmum = keyof typeof Icons;

type ActionsProp = {
  name?: string;
  onClick?: (value?: unknown) => void;
};
export interface NotifyOption {
  /** Notify标题 */
  title: string;
  /** Notify内容 */
  content: string;
  /** Notify图标 */
  icon: IconEmum;
  /** 触发按钮, 最多两个 { Name: string, onClick: cb } */
  actions: [action1?: ActionsProp, action2?: ActionsProp];
  /** Notify持续时间 */
  duration: number;
}

const prefixCls = 'notify';

const $dom = document.createElement("div");
$dom.className = prefixCls + '-container';

type CB_FN_Prop = (value: unknown) => void;

class Notify {
  $:HTMLDivElement;
  _CB: CB_FN_Prop[];
  _REJECTCB: CB_FN_Prop[];
  Dom?: HTMLDivElement;
  _hide = false;
  $pro_dom?: HTMLDivElement;
  /** 全局Notify方法 */
  constructor() {
    this.$ = $dom;
    this._CB = [];
    this._REJECTCB = [];
    if(!isHave($dom, document.body.childNodes)) document.body.appendChild($dom);
  }
  create({ title = "提示", content = '', icon, duration = 4500, actions }: Partial<NotifyOption>) {
    const NotifyDom = document.createElement("div");
    NotifyDom.className = `${prefixCls}-wrap ${icon || ''}`;
    // <div class="notify-wrap ${icon}">
    const iconEl = icon ? `<i class="icon">${Icons[icon]}</i>` : '';
    const NotifyBtn = actions ? `<div class="${prefixCls}-actions">${ actions.map((item, i) => {
      if(item?.onClick) (i ? this._REJECTCB : this._CB).push(item.onClick);
      return `<button class="${prefixCls}-actions-btn">${item?.name || ['确认', '取消'][i]}</button>`;
    }).join('') }</div>` : '';
    NotifyDom.innerHTML = `${iconEl}<div class="${prefixCls}-content"><h3 class="${prefixCls}-title">${title}</h3><div class="${prefixCls}-msg">${content}</div>${NotifyBtn}</div><button class="${prefixCls}-btn">${Icons['error']}</button><div class="${prefixCls}-progress-bar"></div>`
    this.$.append(NotifyDom);
    this.Dom = NotifyDom;
    /** 点击叉叉 回调 */
    (NotifyDom.getElementsByClassName(prefixCls + '-btn')[0] as HTMLDivElement)
      .onclick = (e) => this._REJECT(e);
    const actionsBtns = NotifyDom.querySelectorAll('.'+prefixCls + '-actions-btn'),
      ActionCb = [this._RESOLVE, this._REJECT];
    actionsBtns.forEach((item, i) => item.addEventListener('click',  (e) => {
      ActionCb[i]?.bind(this)(e);
    }))
    // for(let i = 0, len = actionsBtns.length; i < len; i ++) {
    //   actionsBtns[i];
    // }
    this._hide = false
    /** 进度条Dom */
    this.$pro_dom = NotifyDom.getElementsByClassName(prefixCls+'-progress-bar')[0] as HTMLDivElement;
    setTimeout(()=> NotifyDom.style.transform = "translateX(0)", 99);
    duration && setTimeout(() => this._REJECT(), duration);
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
  /** 叉叉关闭 */
  _REJECT(e?: Event) {
    let cb;
    while(cb = this._REJECTCB.shift()) cb(e);
    this.hide();
  }
  _RESOLVE(e?: Event) {
    if(!this._CB.reduce((value, cb) => value || Boolean(cb(e)), false))
      this.hide();
  }
  then(Fn: (value: unknown)=>void){
    this._CB.push(Fn)
    return this
  }
  cacth(Fn: (value: unknown)=>void){
    this._REJECTCB.push(Fn)
    return this;
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

notify.success = (content: string, title?: string, duration?: number) => notify({ content, title, icon: "sucess", duration });

export default notify;