import { useEffect, useState } from "preact/hooks";

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
  return (<div style={{ height: '100vh' }} className="container flex-algin">
    { <ModalBlock  unit="日" num={ day }/> }
    { <ModalBlock  unit="时" num={ hours }/> }
    { <ModalBlock  unit="分" num={ minutes }/> }
    { <ModalBlock  unit="秒" num={ seconds }/> }
  </div>)
}

export default function () {
  let isTurn:boolean;
  let time = ~~((Date.parse('2022/12/18') - Date.now()) / 1e3);
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
    timer = setInterval(()=> {
      // if(isTurn){
      //   if(++seconds > 59) {
      //     seconds = 0
      //     if(++minutes > 59){
      //       minutes = 0
      //       if(++hours > 23) {
      //         hours = 0
      //         day ++ 
      //       }
      //     }
      //   }
      // }else{
      //   if(seconds-- < 1) {
      //     seconds = 59
      //     if(--minutes < 1){
      //       minutes = 59
      //       if(--hours < 1) {
      //         hours = 23
      //         --day
      //       }
      //     }
      //   }
      // }
      // if(day == 0 && hours == 0 && minutes == 0 && seconds == 0) Modal.success({ content: "已经达到你预定的时间啦!", okText: "确认" })
      setTime({ day, hours, minutes, seconds});
      return () => clearInterval(timer);
    }, 1e3);
  }, []);
  return(<TimeModal time={timeObj} />)
}