import type { RouterProp } from "@/layout/reducer";

import { RouterContext } from "@/layout/index";
import classNames from "classnames";
import { useContext, useEffect, useState } from "preact/hooks";
import Menu from "./Menu/index";
import { route } from "preact-router";
import { createRef } from "preact";
import { React } from '@/layout/typings';
import Switch from "./Switch";
import { setTheme } from "@/utils/utils";
import { SunIcon, MoonIcon } from './Icon';

interface NavBarProps { fixed?: boolean; children?: React.ReactNode };

export const MenuList = [
  { title: 'Home', path: '/' },
  { title: 'Item', path: '/webitem' },
  // { title: 'Cheap', path: '/pages/wg' },
  // { title: 'ZDM', path: '/pages/zdm' },
];

let isLight = false;

export default function (props: NavBarProps) {
  /** 菜单默认下标 */
  const [defaultIndex, setDefaultIndex] = useState(0);
  /** RouterContent */
  const router = useContext<RouterProp>(RouterContext);
  /** 是否在首页 */
  const [ isHome, setIsHome ] = useState(true);
  /** 占位组件高度 */
  const [ seatHeight, setSeatHeight ] = useState(46);
  useEffect(() =>{
    setIsHome(router.url == '' || router.url == '/');
    const currentIndex = MenuList.findIndex(({ path }) => path == router.url);
    if(currentIndex != -1 && currentIndex != defaultIndex) setDefaultIndex(currentIndex);
  }, [router]);
  /** RefMenu */
  const menuRef = createRef<any>();
  useEffect(() => {
    const baseEl = menuRef.current.base as HTMLElement;
    setSeatHeight(baseEl.offsetHeight);
  }, [menuRef]);
  useEffect(() => {
    isLight = setTheme() == 'light';
  },[])
  
  return <>
    <header className={classNames('nav-bar', [ isHome && 'hidden', props.fixed && 'fixed' ])}>
      <div className="container flex-row flex-algin">
        <Menu ref={menuRef}
          defaultIndex={defaultIndex}
          list={MenuList}
          onChange={ (i) => {
            setDefaultIndex(i);
            route(MenuList[i].path, true);
            }
          }/>
        <div className="flex-end">{ 
          props.children ? props.children :
          <Switch
            onChange={ (value) => setTheme({ theme: value ? "light":'dark' }) }
            title="切换当前主题颜色"
            onNode={ <SunIcon /> }
            offNode={ <MoonIcon /> }
            className="home-theme-swicth"
            current={ isLight }
          />
        }</div>
      </div>
    </header>
    { props.fixed &&  <div style={{ height: seatHeight }} className="nav-bar-seat" /> }
  </>
}
