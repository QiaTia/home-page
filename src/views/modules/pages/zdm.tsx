import Spin from "@/components/Spin/index"
import { getZdmList } from "@/serves/api"
import { useEffect, useRef, useState } from "preact/hooks"
import Menu from "@/components/Menu/index";
import "@/components/List/index.less";

export default () => {
  const [ filterList, setFilterList ] = useState<API.zdmFilterProps[]>([])
  const [ filterKey, setFilterKey ] = useState<string>()
  const [ list, setList ] = useState<API.zdmListItemProps[]>([])
  const [ state, setState ] = useState<'loading' | 'ready' | 'error'>('loading')
  /** 请求序号，避免快速切换分类时旧响应覆盖新数据 */
  const reqId = useRef(0)

  function init(filter?: string) {
    const id = ++reqId.current
    setList([])
    setState('loading')
    getZdmList(filter).then((res) => {
      if (id !== reqId.current) return
      // 拦截器已在运行时解包 data，但库的类型仍返回 RequestResult，这里按实际结构收窄
      const result = res as unknown as { tabs?: API.zdmFilterProps[]; data?: API.zdmListItemProps[] }
      // 接口异常时可能返回字符串/Error，不能直接交给 map
      if (!Array.isArray(result.tabs) || !Array.isArray(result.data)) throw new Error('invalid data')
      setFilterList(result.tabs);
      setList(result.data);
      setState('ready')
    }).catch(() => {
      if (id === reqId.current) setState('error')
    });
  }

  function handleClick (i: number) {
    setFilterKey(filterList[i].filter);
  }

  useEffect(()=> init(filterKey), [filterKey])
  
  return <>
    <div className="container article-menu">
      <Menu onChange={ handleClick } list={ filterList.map(({ title })=> ({ title })) } />
    </div>

    <div className="container article-list">
      {
        list.map(item=><article role="article" key={item.id} className="article typo">
        <a target="_blank" href={`https://www.smzdm.com/p/${item.id}/`}>
          <h3 className="entry-title">{item.title}</h3>
        </a>
        <div className="entry-content">
          <span>{item.parseTime}</span>
          <span>{item.price}</span>
          <a target="_blank" href={item.link}>To Buy</a>
        </div>
      </article>)
      }
      {
        state === 'loading' && <Spin size="large" tip="数据准备中~" />
      }
      {
        state === 'error' && <div className="flex-algin">数据加载失败，请稍后重试~</div>
      }
    </div>
  </>
}