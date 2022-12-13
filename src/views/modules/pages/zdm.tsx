import Spin from "@/components/Spin/index"
import { getZdmList } from "@/serves/api"
import { useEffect, useState } from "preact/hooks"
import Menu from "@/components/Menu/index";

export default () => {
  const [ filterList, setFilterList ] = useState<API.zdmFilterProps[]>([])
  const [ filterKey, setFilterKey ] = useState<string>()
  const [ list, setList ] = useState<API.zdmListItemProps[]>([])

  function init(filter?: string) {
    setList([]);
    // @ts-ignore
    getZdmList(filter).then(({ tabs, data, tab })=>{
      setFilterList(tabs);
      // @ts-ignore
      setList(data);
    });
  }

  function handleClick (i: number) {
    setFilterKey(filterList[i].filter);
    // setList([])
    // init(key)
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
        list.length < 1 && <Spin size="large" tip="数据准备中~" />
      }
    </div>
  </>
}