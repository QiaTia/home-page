import Footer from "@/components/Footer";
import { getDsapi } from "@/serves/api";
import notify from "@/utils/notify";
import Router from "preact-router";
import AsyncRoute from 'preact-async-route';
import { useEffect, useReducer } from "preact/hooks";
import routers from "./router";
import { scrollTo } from '@/utils/utils';
import BackTop from "@/components/back-top/index";
import Spin from "@/components/Spin/index";
import { initState, reducer, RouterProp } from "./reducer";
import { createContext } from "preact";
import NavBar from "@/components/NavBar";

const TitileEnum: Record<string, string> = {};

export const RouterContext = createContext<RouterProp>(initState);

export default function Layout() {

  const [ curretRouter, dispatchRouter ] = useReducer(reducer, initState);

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
      <NavBar />
      <Router onChange={function (e) {
        console.log(e.router.props.children);
        scrollTo();
        document.title = TitileEnum[e.url] || TitileEnum['/'] || '';
        dispatchRouter({ type: 'SET_VALUE', payload: { url: e.url, previous: e.previous, title: TitileEnum[e.url] } })
      }}>
        {
          routers.map(route => {
            const path = route.path;
            if(route.title) TitileEnum[route.path] = route.title;
            if(typeof route.component =='function')
              // @ts-ignore 
              return <route.component path={ path } />
            else
              return <AsyncRoute
                path={ path }
                loading={() => <Spin />}
                getComponent={() => (route.component as Promise<any>).then(module => module.default)}
              />
          })
        }
      </Router>
      <BackTop visibilityHeight={100} />
      <ul className="animo-wrap">
        {
          Array(10).fill(0).map((_, i)=> <li key={i}></li>)
        }
      </ul>
      <Footer />
    </RouterContext.Provider>
  )
};