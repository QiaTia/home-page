import { route } from 'preact-router';
import List from '@/components/List';
/** 懒加载数据 */
import './layout.less';

export default function () {
  const list = [
    {
      t: 'TinyImage',
      d: 'Web Worker子线程使用wasm有损压缩图片, 压缩率不错!',
      h: '/webitem/image/tiny'
    },
    {
      t: "JWT解析",
      d: "JWT token内容解析",
      h: "/webitem/jwt"
    },
    {
      t: "坐标解析",
      d: "坐标解析或拾取",
      h: "/webitem/map"
    },
    // {
    //   t: "趣味答题",
    //   d: "趣味答题练习",
    //   h: "/webitem/exam/random"
    // },
    {
      t: "ToBase64",
      d: "Web Worker子线程处理复杂计算任务, 流畅Base64转换!",
      h: "/webitem/base64"
    }, {
      t: "Tia Player",
      d: "在线的网页音乐播放器,两行代码嵌入网页!",
      // h: 'http://v.qiatia.cn/tia-player/'
    }, {
      t: "CountDown",
      d: "React 数字动画的倒计时",
      h: '/webitem/countdown'
    }, {
      t: "爱心日食",
      d: "CSS 绘制的爱心日食动画",
      h: "/webitem/eclipse"
    }, {
      t: "下雪吧",
      d: "CSS绘制下雪的动画!",
      h: '/webitem/snow'
    }, {
      t: "Peach",
      d: "canvas绘制的桃花飘落动画",
      h: "/webitem/peach"
    }, {
      t: "Rain",
      d: "canvas绘制的落雨动画",
      h: "/webitem/canvas-rain"
    }, {
      t: "Snow",
      d: "canvas绘制的雪花飘零动画",
      h: "/webitem/canvas-snow"
    }, {
      t: "在线打字游戏机",
      d: "小霸王打字机-其乐无穷",
      h: "/webitem/typing"
    },
    {
      t: "Exam",
      d: "毕业设计项目, 在线考试系统",
      h: "https://github.com/qiatia/exam"
    }
    // {
    //   t: "OS-X",
    //   d: "残缺的一个系统",
    //   h: "http://v.qiatia.cn/OS-X/"
    // }, {
    //   t: "ManageMoneyMatters",
    //   d: "ManageMoneyMatters",
    //   h: "http://mm.qiatia.cn/"
    // }
  ];
  function handleTap({ h }: typeof list[number]) {
    if (!h) return ;
    else if (h[0] == '/') route(h);
    else window.location.href = h
  };
  return (<List<typeof list[0]> handleTap={handleTap} list={list}/>)
}