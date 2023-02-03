import "@/components/List/index.less";
import Spin from "@/components/Spin/index"
import { getWgList } from "@/serves/api"
import { useEffect, useState } from "preact/hooks"


export default ()=>{
  const [ list, setList ] = useState<API.wgListItemProps[]>([])
  useEffect(()=>{
    getWgList()
      // @ts-ignore
      .then( list => setList(list));
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
      list.length < 1 && <Spin size="large" tip="数据准备中~" />
    }
  </div>
}