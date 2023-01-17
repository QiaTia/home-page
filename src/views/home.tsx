import Button from '@/components/Button';
import { CodepenCircleOutlined, GithubOutlined, SlackOutlined } from '@ant-design/icons';
import { route } from 'preact-router';

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
  return <div className="container home-page flex-column">

  <div style={{ marginTop: '48px' }} class="flex-row home-page-btn-group">
  {
    groupList.map(({ ti, url, icon })=> <Button onClick={ () => onTap(url) } bird icon={ icon } key={ url } children={ ti } />)
  }
  </div>
</div>
}
