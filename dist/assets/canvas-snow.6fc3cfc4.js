var y=Object.defineProperty;var m=(i,t,n)=>t in i?y(i,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):i[t]=n;var o=(i,t,n)=>(m(i,typeof t!="symbol"?t+"":t,n),n);import{h as x,o as d,y as g}from"./index.8f8765f3.js";function s(i){let t,n;switch(i){case"x":t=Math.random()*window.innerWidth;break;case"y":t=Math.random()*window.innerHeight;break;case"r":t=2+Math.random()*6;break;case"fnx":n=27+Math.random()*100,t=function(r,e){return r+.5*Math.sin(e/n)};break;case"fny":n=.4+Math.random()*1.4,t=function(r,e){return e+n};break}return t}class p{constructor(t,n,r,e){o(this,"x");o(this,"y");o(this,"r");o(this,"fn");this.x=t,this.y=n,this.r=r,this.fn=e}draw(t){var n=t.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r);n.addColorStop(0,"rgba(255, 255, 255, 0.9)"),n.addColorStop(.5,"rgba(255, 255, 255, 0.5)"),n.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=n,t.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2)}update(){this.x=this.fn.x(this.x,this.y),this.y=this.fn.y(this.y,this.y),(this.x>window.innerWidth||this.x<0||this.y>window.innerHeight||this.y<0)&&(this.x=s("x"),this.y=0)}}class b{constructor(){o(this,"list",[])}push(t){this.list.push(t)}update(){for(let t=0,n=this.list.length;t<n;t++)this.list[t].update()}draw(t){for(var n=0,r=this.list.length;n<r;n++)this.list[n].draw(t)}get(t){return this.list[t]}}let h;function S(i){i.height=window.innerHeight,i.width=window.innerWidth;const t=i.getContext("2d"),n=new b;for(let e=0;e<200;e++){let w=s("x"),l=s("y"),c=s("r"),u=s("fnx"),f=s("fny"),a=new p(w,l,c,{x:u,y:f});a.draw(t),n.push(a)}function r(){t.clearRect(0,0,i.width,i.height),n.update(),n.draw(t),h=window.requestAnimationFrame(r)}h=requestAnimationFrame(r)}function M(){const i=g();return x(()=>(i.current&&S(i.current),window.scrollTo({top:46}),window.onresize=function(){i.current&&(i.current.width=window.innerWidth,i.current.height=window.innerHeight)},function(){window.onresize=null,window.cancelAnimationFrame(h)}),[i]),d("div",{style:"background-color: #242424",className:"home-page",children:d("canvas",{style:"position: fixed;left: 0;top: 0;pointer-events: none;",ref:i})})}export{M as default};
