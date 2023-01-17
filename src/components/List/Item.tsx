
interface ItemProp {

}

export const Item = function ({ key }: ItemProp) {
  return (
    <article role="article" key={key} className="article typo">
      <a onClick={() => handleTap?.(item)}>
        <h3 className="entry-title">{item.t}</h3>
      </a>
      <div className="entry-content">
        <span>{item.d}</span>
        {/* {item.t} */}
      </div>
    </article>
  )
}