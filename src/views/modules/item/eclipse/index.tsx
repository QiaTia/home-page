import { useEffect } from 'preact/hooks';
import './index.less';


export default function() {
  useEffect(() => window.scrollTo({ top: 46 }), []);
  return (<div className="eclipse-wrap flex-algin"
    style={{ 
      width: '100%', 
      backgroundColor: 'skyblue',
      animation: 'here 6s 0s linear infinite'
      }
    }>
    {
      [0, 0].map(() => <div className="eclipse-item" />)
    }
    </div>
  )
}