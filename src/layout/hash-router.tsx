import { ComponentChildren, createElement } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface RouteConfig {
  path: string;
  title?: string;
  /** 同步组件为函数声明，懒加载路由为返回 import() 的箭头函数 */
  component: any;
}

export interface RouteChange {
  url: string;
  previous: string;
}

/** 当前 hash 对应的路径，如 #/webitem/jwt -> /webitem/jwt */
export function getHashUrl() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

/** 跳转路由，replace 为 true 时不写入浏览历史 */
export function route(url: string, replace = false) {
  const next = `#${url}`;
  if (replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);
  // pushState 不会触发 hashchange，需要手动通知
  window.dispatchEvent(new Event('hashchange'));
}

interface RouteViewProps {
  config: RouteConfig;
  url: string;
  loading: ComponentChildren;
}

function RouteView({ config, url, loading }: RouteViewProps) {
  const [Component, setComponent] = useState<any>(() =>
    config.component.prototype ? config.component : null
  );

  useEffect(() => {
    if (Component) return;
    let alive = true;
    config
      .component()
      .then((mod: any) => {
        if (alive) setComponent(() => mod.default ?? mod);
      })
      .catch((error: unknown) => {
        console.error(`路由加载失败：${config.path}`, error);
      });
    return () => {
      alive = false;
    };
  }, [Component, config]);

  if (!Component) return <>{loading}</>;
  return createElement(Component, { path: config.path, url });
}

interface RouterProps {
  routes: RouteConfig[];
  loading: ComponentChildren;
  onChange?: (change: RouteChange) => void;
}

/** 极简 hash 路由，替代已停止维护的 preact-router / preact-async-route */
export default function Router({ routes, loading, onChange }: RouterProps) {
  const [url, setUrl] = useState(getHashUrl);
  const previous = useRef(url);

  useEffect(() => {
    const sync = () => setUrl(getHashUrl());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    // 首帧渲染到 effect 执行之间可能已经发生过 hash 变化，先同步一次
    sync();
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    const prev = previous.current;
    previous.current = url;
    onChange?.({ url, previous: prev });
  }, [url]);

  const matched =
    routes.find((item) => item.path === url) ?? routes.find((item) => item.path === '/');
  if (!matched) return null;

  return <RouteView key={matched.path} config={matched} url={url} loading={loading} />;
}
