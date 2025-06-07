export interface RouterProp {
  /** 当前路径 */
  url: string;
  /** 来自 */
  previous?: string;
  /** 页面标题 */
  title?: string;
}

const eventList = ['SET_VALUE'] as const;

export const initState = {
  url: '/',
  previous: ''
};

export function reducer(state: RouterProp,{ type, payload } : { type: typeof eventList[number], payload: RouterProp }){
  switch(type) {
    case eventList[0]: return { ...state, ...payload };
  default:  return state;
  }
}