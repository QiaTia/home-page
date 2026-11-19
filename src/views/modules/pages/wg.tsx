import "@/components/List/index.less";
import Spin from "@/components/Spin/index"
import { getWgList } from "@/serves/api"
import { useEffect, useState } from "preact/hooks"


export default ()=>{
  const [ list, setList ] = useState<API.wgListItemProps[]>([])
  const [ state, setState ] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(()=>{
    let alive = true
    getWgList()
      .then( data => {
        if (!alive) return
        // 接口异常时可能返回字符串/Error，不能直接交给 map
        if (!Array.isArray(data)) throw new Error('invalid data')
        setList(data)
        setState('ready')
      })
      .catch(() => {
        if (alive) setState('error')
      })
    return () => { alive = false }
  }, [])
  return <div className="container article-list">
    {
      list.map((item, index)=><article role="article" key={ index } className="article typo">
      <a target="_blank" href={item.h}>
        <h3 className="entry-title">{item.t}</h3>
      </a>
      <div className="entry-content">
        <span>{item.d}</span>
        {item.t}
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
}