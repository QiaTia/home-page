import './home.less';
import Button from '@/components/Button';
import { CodepenCircleOutlined, GithubOutlined, SlackOutlined } from '@ant-design/icons';
import { route } from 'preact-router';
import { setTheme } from '@/utils/utils';

/**
 * @description 遍历获取播放器元素
 */
function getTia(): Promise<Element> {
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

export default function Home() {
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
    if(url[0] == '/') route(url);
    else window.location.href = url;
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
