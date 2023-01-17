export { Item } from './Item';

interface ListProp<T> {
  list: T[];
  handleTap?: (item: T) => void
}

function List<T>({ list, handleTap }: ListProp<T>) {
  return (<div className="article-list container">
  {
    list.map((item, index) => <Item />)
  }
</div>)
}

export default List;