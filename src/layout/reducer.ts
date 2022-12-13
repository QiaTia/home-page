export interface RouterProp {
  /** 当前路径 */
  url: string;
  /** 来自 */
  previous?: string;
  /** 页面标题 */
  title?: string;
}

type TypeEmun = 'SET_VALUE';

export const initState = {
  url: '/',
  previous: ''
};

export function reducer(state: RouterProp,{ type, payload } : { type: TypeEmun, payload: RouterProp }){
  switch(type) {
    case 'SET_VALUE': return { ...state, ...payload };
  default:  return state;
  }
}