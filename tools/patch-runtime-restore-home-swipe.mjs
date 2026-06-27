import fs from 'node:fs';
const p='recovery/good-apk-public/assets/index-1_-kxmKC.js';
let s=fs.readFileSync(p,'utf8');
const changes=[];
function rep(a,b,label){if(!s.includes(a)) throw new Error('missing '+label); s=s.replace(a,b); changes.push(label)}
rep('l=t=>{window.setTimeout(()=>{a.current.isDown=!1,n($n),e(t)},0)}','l=t=>{window.setTimeout(()=>{a.current.isDown=!1,n($n),e(t)},120)}','restore home navigation delay');
rep('f=e=>{e.preventDefault(),o();let{x:t,y:r,moved:i}=a.current,s=Math.hypot(t,r),c=Math.abs(t),u=Math.abs(r),d=92,p=1.45;if(a.current.isDown=!1,!i||s<8){m();return}if(c>d&&c>u*p){l(t<0?`favorites`:`notes`);return}if(u>d&&u>c*p){l(r>0?`album`:`podcast`);return}n(e=>({...e,x:0,y:0,rotation:0,active:!1,longPress:!1}))}','f=e=>{e.preventDefault(),o();let{x:t,y:r,moved:i}=a.current,s=Math.hypot(t,r);if(a.current.isDown=!1,!i||s<8){m();return}if(Math.abs(t)>Math.abs(r)&&t<0&&s>24){l(`favorites`);return}if(s>48){if(Math.abs(t)>Math.abs(r)&&t>0){l(`notes`);return}if(Math.abs(r)>Math.abs(t)){l(r>0?`album`:`podcast`);return}}n(e=>({...e,x:0,y:0,rotation:0,active:!1,longPress:!1}))}','restore previous home swipe feel');
fs.writeFileSync(p,s,'utf8');
console.log(changes.join('\n'));
