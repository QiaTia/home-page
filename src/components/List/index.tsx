import { JSX } from 'preact/jsx-runtime';
export { Item } from './Item';
import './index.less';

interface ListProp<T> {
  /** 数据源 */
  list: T[];
  /** 点击事件 */
  handleTap?: (item: T) => void;
  Item?: JSX.Element
}

function List<T = Record<string, string>>({ list, handleTap, Item }: ListProp<T>) {
  return (<div className="article-list container">
  {
    list.map((item, index) => <article role="article"
      onClick={() => handleTap?.(item)}
      key={index}
      className="article typo">
        {
          // @ts-ignore
          Item && <Item item={item} />
        }
        {Item || <>
          <a>
            {/* @ts-ignore */}
            <h3 className="entry-title">{item.t}</h3>
          </a>
          <div className="entry-content">
            {/* @ts-ignore */}
            <span>{item.d}</span>
            {/* @ts-ignore */}
            {item.t}
          </div>
        </>}
  </article>)
  }
</div>)
}

export default List;