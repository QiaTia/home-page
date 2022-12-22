import Footer from "@/components/Footer";
import { getDsapi } from "@/serves/api";
import notify from "@/utils/notify";
import Router from "preact-router";
import AsyncRoute from 'preact-async-route';
import { useEffect, useReducer, useState } from "preact/hooks";
import routers from "./router";
import { scrollTo } from '@/utils/utils';
import BackTop from "@/components/BackTop/";
import Spin from "@/components/Spin/index";
import { initState, reducer, RouterProp } from "./reducer";
import { createContext } from "preact";
import NavBar, { MenuList } from "@/components/NavBar";

const TitileEnum: Record<string, string> = {};

export const RouterContext = createContext<RouterProp>(initState);

const FixedPathList = MenuList.map(item => item.path);


/**
 * @description 遍历获取播放器元素
 */
function getTia(): Promise<HTMLDivElement> {
  return new Promise((resolve, reject)=>{
    let t = 0
    const getTia = () => {
      if(++t > 100) reject('Timeout')
      const Tia = document.body.querySelector<HTMLDivElement>('.Tia-player');
      if(!Tia) setTimeout(() => getTia(), 5e2);
      else resolve(Tia);
    };
    getTia();
  });
}

export default function Layout() {

  const [ curretRouter, dispatchRouter ] = useReducer(reducer, initState);
  const [ isFixed, seFixed ] = useState(true);
  function getAPI() {
    getDsapi().then(({ data })=> {
      notify(data.note, data.content, void 0, 0);
    });
  }
  useEffect(()=> {
    getAPI();
  }, []);
  return (
    <RouterContext.Provider value={curretRouter}>
      <NavBar fixed={ isFixed } />
      <Router onChange={function (e) {
        getTia().then(tia => tia.style.fontSize = `${e.url == '/' ? 18 : 16}px`);
        scrollTo(0);
        seFixed(FixedPathList.includes(e.url));
        document.title = TitileEnum[e.url] || TitileEnum['/'] || '';
        dispatchRouter({ type: 'SET_VALUE', payload: { url: e.url, previous: e.previous, title: TitileEnum[e.url] } })
      }}>
        {
          routers.map(route => {
            const path = route.path;
            if(route.title) TitileEnum[route.path] = route.title;
            if(route.component.name !== 'component')
              // @ts-ignore 
              return <route.component path={ path } />
            else
              return <AsyncRoute
                path={ path }
                loading={() => <Spin />}
                getComponent={async () => (await route.component() as any).default }
              />
          })
        }
      </Router>
      <BackTop />
      <ul className="animo-wrap">
        {
          Array(10).fill(0).map((_, i)=> <li key={i} />)
        }
      </ul>
      <Footer />
    </RouterContext.Provider>
  )
};