import Footer from "@/components/Footer";
import { getDsapi } from "@/serves/api";
import notify from "@/utils/notify";
import Router from "preact-router";
import AsyncRoute from 'preact-async-route';
import { createHashHistory, createBrowserHistory } from 'history';
import { useReducer, useState, useEffect } from "preact/hooks";
import routers from "./router";
import { scrollTo, textToSound } from '@/utils/utils';
import BackTop from "@/components/BackTop/";
import Spin from "@/components/Spin/index";
import { initState, reducer, RouterProp } from "./reducer";
import { createContext } from "preact";
import NavBar, { MenuList } from "@/components/NavBar";
import tiaBus from '@/store/bus';

const titleList = new Map<string, string>();

export const RouterContext = createContext<RouterProp>(initState);

const FixedPathList = MenuList.map(item => item.path);


/**
 * @description 遍历获取播放器元素
 */
function getTia(): Promise<HTMLDivElement> {
  return new Promise((resolve, reject) => {
    let t = 0
    const getTia = () => {
      if (++t > 100) reject('Timeout')
      const Tia = document.body.querySelector<HTMLDivElement>('.Tia-player');
      if (!Tia) setTimeout(() => getTia(), 5e2);
      else resolve(Tia);
    };
    getTia();
  });
}

export default function Layout() {

  const [currentRouter, dispatchRouter] = useReducer(reducer, initState);
  const [isFixed, seFixed] = useState(true);
  function getAPI() {
    getDsapi().then(({ data }) => {
      notify({
        content: data.note,
        title: data.content,
        duration: 0,
        actions: [{
          name: '朗读', 
          onClick() {
            textToSound(data.content);
            return true;
          }
        }]
      });
    });
  }
  function onPaste(ev: ClipboardEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    // @ts-ignore
    const clipboard = (ev.clipboardData || window.clipboardData) as DataTransfer;
    const onPublish = (payload: string | File, type = 'text') => tiaBus.publish({ ev: 'paste', type, payload })
    const types = Array.from(clipboard.types).map(t => t.toLowerCase());
    if (types.includes('files')) {
      const file = clipboard.files[0];
      onPublish(file, 'file');
    } else if(types.includes('text/plain')) {
      const text = clipboard.getData('text/plain');
      onPublish(text);
    } else {
      console.log(types);
    }
  }
  // 暂时注释在线服务
  useEffect(() => {
    getAPI();
    document.body.addEventListener('paste', onPaste);
  }, []);
  return (
    <RouterContext.Provider value={currentRouter}>
      <NavBar fixed={isFixed} />
      <Router history={createHashHistory()} onChange={function (e) {
        // 暂时注释在线服务
        // getTia().then(tia => tia.style.fontSize = `${e.url == '/' ? 18 : 16}px`);
        scrollTo(0);
        seFixed(FixedPathList.includes(e.url));
        const title = titleList.get(e.url) || titleList.get('/') || '';
        document.title = title;
        dispatchRouter({ type: 'SET_VALUE', payload: { url: e.url, previous: e.previous, title: title } })
      }}>
        {
          routers.map(route => {
            const path = route.path;
            if (route.title) titleList.set(route.path, route.title);
            if (route.component.name !== 'component')
              // @ts-ignore 
              return <route.component path={path} />
            else
              return <AsyncRoute
                path={path}
                loading={() => <div style={{ margin: '8em 0' }} className="flex-algin"> <Spin /></div>}
                getComponent={async () => (await route.component() as any).default}
              />
          })
        }
      </Router>
      <BackTop />
      <ul className="animo-wrap">
        {
          Array(10).fill(0).map((_, i) => <li key={i} />)
        }
      </ul>
      <Footer />
    </RouterContext.Provider>
  )
};