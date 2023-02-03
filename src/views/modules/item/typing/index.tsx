import classNames from "classnames";
import { useEffect, useState } from "preact/hooks";
import './index.less';

function show() {
  const code = Math.floor(Math.random() * 26) + 65;
  return { code, str: String.fromCharCode(code) };
}
let errTime = 0;

export default function typing () {
  const [ current , setChar ] = useState(show()),
    [ count, setCount ] = useState({ succes: 0, error: 0 }),
    [isError, setError] = useState(false);
  useEffect(() => {
    window.onkeydown = function (e) {
      if(e.key == 'Control') return ;
      if(current.code == e.keyCode){
        setChar(show());
        setCount(e => {
          e.succes ++;
          return e;
        });
      }else{
        setCount(e => {
          e.error ++;
          return e;
        });
        onError();
      }
    };
    return function () {
      window.onkeydown = null;
      clearTimeout(errTime);
    }
  },[current]);
  function onError() {
    setError(true);
    clearTimeout(errTime);
    errTime = window.window.setTimeout(() => setError(false), 300);
  }
  return <div style="background-color: #242424;justify-content: center;" className="home-page flex-column flex-algin">
      <div onClick={onError} className={ classNames('typing-char ', isError && 'error')}>
        <span>{ current.str }</span>
      </div>
      <p style="margin-top: 1em;font-size: 1.2em;color: #9e9e9e;">正确数:{ count.succes } 错误数: { count.error } 正确率:{ (count.succes / (count.succes + count.error) * 100).toFixed(2) }% </p>
  </div>
}