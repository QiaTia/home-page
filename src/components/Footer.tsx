import { JSX } from "preact";

interface footerItemProps {
  title: string
  list?: Array<string>
  content?: string | JSX.Element
}

interface friendsItemProps {  name: string; href: string, remarks: string }
interface friendsProps { title: string; list: Array<friendsItemProps> }

export default function() {
  const myFriends: friendsProps  = {
    title: "我的朋友们",
    list: [
      {
        name: "TimeCost",
        href: "http://timecost.top",
        remarks: ""
      }, {
        name: "V2EX",
        href: "https://www.v2ex.com",
        remarks: ""
      }
    ]
  }
  
  const footerContent:Array<footerItemProps> = [
    {
      title: "我的朋友们",
      content: <>{ myFriends.list.map(({ name, href }, i)=><a key={ i } href={ href +'?r=https://qiatia.cn' } target="_blank">{ name }</a>) }</>
    }, {
      title: "关于网站",
      content: "Begin with interest, and be loyal to technology."
    }, {
      title: "联系我",
      content: <>
        <a href="mailto:QiaTia@qq.com">QiaTia@qq.com</a>
        <a href="https://github.com/QiaTia" target="_blank">GitHub</a>
        {/* <a href="https://gitee.com/QiaTia" target="_blank">Gitee</a> */}
      </>
    }
  ]
  return <footer className="footer container">
    <div className="flex-row typo">
      {
        footerContent.map(item=>
          <div className="flex-auto" key={ item.title }>
            <span>» {item.title}:</span>
            <div className="color-grey">
              {
                item.content && item.content
              }
              {
                item.list && item.list.map((t, i)=><p key={ i }>{t}</p>)
              }
            </div>
          </div>
        )
      }
      {/* <div className="foot-friends">
        <div className="title">» { myFriends.title }:</div>
        <div className="content">
          {
            myFriends.list.map(({href, name})=><a href={href} target="_blank" key={name}>{name}</a>)
          }
        </div>
      </div> */}
    </div>
    <p className="copyright typo">Copyright 2018 <a onClick={ e => e.preventDefault() }>QiaTia</a></p>
  </footer>
}
