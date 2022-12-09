import Spin from "@/components/Spin/index"
import { getZdmList } from "@/serves/api"
import { useEffect, useState } from "preact/hooks"

export default () => {
  const [ filterList, setFilterList ] = useState<API.zdmListItemProps[]>([])
  const [ filterKey, setFilterKey ] = useState('')
  const [ list, setList ] = useState<API.zdmFilterProps[]>([])

  function init(filter?:string):void {
    getZdmList(filter).then(({ tabs, data, tab })=>{
      setFilterList(tabs)
      setFilterKey(tab.filter)
      setList(data)
    })
  }

  function handleClick ({key}:any):void {
    setFilterKey(key)
    setList([])
    init(key)
  }

  useEffect(()=>init(), [])
  
  return <>
    {/* <Menu className="container" onClick={ handleClick } selectedKeys={[filterKey]} mode="horizontal">
      {
        filterList.map((item)=> <Menu.Item key={ item.filter }>
          { item.title }
        </Menu.Item>)
      }
    </Menu> */}
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