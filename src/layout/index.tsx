import Footer from "@/components/Footer";
import { getDsapi } from "@/serves/api";
import notify from "@/utils/notify";
import Router from "preact-router";
import AsyncRoute from 'preact-async-route';
import { useEffect } from "preact/hooks";
import routers from "./router";
import { scrollTo } from '@/utils/utils';
import BackTop from "@/components/back-top/index";
import Spin from "@/components/Spin/index";

const TitileEnum: Record<string, string> = {};

export default function Layout() {
  function getAPI() {
    getDsapi().then(({ data })=> {
      notify(data.note, data.content, void 0, 0);
    });
  }
  useEffect(()=> {
    getAPI();
  }, []);
  return (
    <>
      <Router onChange={function (e) {
        scrollTo();
        document.title = TitileEnum[e.url] || TitileEnum['/'] || '';
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
    </>
  )
}