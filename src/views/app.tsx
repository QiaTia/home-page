import { useEffect, useState } from 'preact/hooks';
import { getDsapi } from '../serves/api';
import Footer from "../components/Footer";
import './app.less';
import { setTheme, textToSound } from '../utils/utils';
import notify from '../utils/notify';
import Button from '@/components/Button/index';
import { CodepenCircleOutlined, GithubOutlined, SlackOutlined } from '@ant-design/icons';
import Router, { route } from 'preact-router';
import Layout from './modules/layout';

/**
 * @description 遍历获取播放器元素
 */
function getTia():Promise<Element> {
  return new Promise((resolve, reject)=>{
    let t = 0
    const getTia = () => {
      if(++t > 100) reject('Timeout')
      const Tia = document.getElementsByClassName('Tia-player')[0];
      if(!Tia) setTimeout(() => getTia(), 5e2);
      else resolve(Tia);
    };
    getTia();
  });
}

function Home() {
  const groupList = [
    {
      ti: 'Blog',
      url: 'https://blog.qiatia.cn',
      icon: <CodepenCircleOutlined />
    }, {
      ti: 'Stroll',
      url: '/webitem',
      icon: <SlackOutlined />
    }, {
      ti: 'Github',
      icon: <GithubOutlined />,
      url: 'https://github.com/QiaTia'
    }
  ];
  function onTap (url:string) {
    if(url[0] == '/') {
      // Todo
      route(url)
    }
    else window.location.href = url
  };
  return <div className="container content flex-column">
  <div class="flex-row content-btn-group">
  {
    groupList.map(({ ti, url, icon })=> <Button onClick={ () => onTap(url) } icon={ icon } key={ url } children={ ti } />)
  }
  {/* <Button onClick={() => setTheme({ change: true })}>Switch Theme</Button> */}
  </div>
</div>
}

export function App() {
  useEffect(()=> {
    getAPI();
  }, []);

  function getAPI() {
    getDsapi().then(({ data })=> {
      notify(data.note, data.content, void 0, 0);
    });
  }
  
  return (
    <>
      <Router>
        <Home path="/" />
        <Layout path='/webitem' />
      </Router>
      <ul className="animo-wrap">
        {
          Array(10).fill(0).map((_, i)=> <li key={i}></li>)
        }
      </ul>
      <Footer />
    </>
  )
}
