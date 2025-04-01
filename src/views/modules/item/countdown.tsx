import notify from "@/utils/notify";
import { useEffect, useState } from "preact/hooks";
import './style/countdown.less';

let timer:number;

interface modalParams { 
  unit : string,
  num : number
}

interface timeParams {
  time:{
    day : number,
    hours : number,
    minutes : number,
    seconds : number
  }
}

const NumBlock = ({ num = 0}) =>{
  return(
    <ul style={{transform: `translateY(-${ num }em)`}}>
      {
        new Array(10).fill(0).map((t,i)=>(<li key={i}>{i}</li>))
      }
    </ul>
  )
}

const ModalBlock = ({ unit, num } : modalParams)=>{
  if(num > 99) return (<p>Error, Num max is 99!</p>);
  const i:number = ~~(num/10);
  const j:number = num % 10;
  return (
    <div className="modal-scroll">
      <div className="modal-scroll-item">
        <NumBlock num={i} />
        <NumBlock num={j} />
      </div>
      <span className="num">{ unit }</span>
    </div>
  )
}

const TimeModal = ({ time:{ day, hours, minutes, seconds }}:timeParams) => {
  // const [ day, hours, minutes, seconds ] = [ , time.getHours(), time.getMinutes() ,time.getSeconds()]
  const list = [
    { name: '时', value: hours },
    { name: '分', value: minutes },
    { name: '秒', value: seconds },
  ];
  if(day == 0 && hours == 0) list.shift();
  if(day > 0) list.unshift({ name: '日', value: day });

  return (<>{ list.map((item) => <ModalBlock key={item.name} unit={ item.name } num={ item.value }/>) }</>)
}

export default function () {
  let isTurn: boolean;
  let time = ~~((Date.parse('2025/10/01') - Date.now()) / 1e3);
  isTurn = time <= 0;
  time = Math.abs(time);
  let day: number = ~~(time / 86400);
  let hours: number = ~~((time - (day * 86400)) / 3600);
  let minutes: number = ~~((time - (day * 86400) - (hours * 3600)) / 60);
  let seconds: number = time % 60;
  const [ timeObj, setTime ] = useState({ day, hours, minutes, seconds });
  
  useEffect(() => {
    window.scrollTo({ top: 46 });
    clearInterval(timer);
    timer = window.setInterval(()=> {
      if(isTurn){
        if(++seconds > 59) {
          seconds = 0
          if(++minutes > 59){
            minutes = 0
            if(++hours > 23) {
              hours = 0
              day ++ 
            }
          }
        }
      }else{
        if(seconds-- < 1) {
          seconds = 59
          if(--minutes < 1){
            minutes = 59
            if(--hours < 1) {
              hours = 23
              --day
            }
          }
        }
      }
      if(day == 0 && hours == 0 && minutes == 0 && seconds == 0) notify({ content: "已经达到你预定的时间啦!" });
      setTime({ day, hours, minutes, seconds});
      return () => clearInterval(timer);
    }, 1e3);
  }, []);
  return(
  <div style={{ height: '100vh' }} className="container flex-algin">
    {/* <input onInput={console.log} type="datetime-local" /> */}
    <TimeModal time={timeObj} />
  </div>)
}
