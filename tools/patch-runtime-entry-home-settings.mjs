import fs from 'node:fs';
const path = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let s = fs.readFileSync(path, 'utf8');
let changed = [];
function replaceOnce(find, repl, label) {
  if (!s.includes(find)) throw new Error('Missing pattern: ' + label);
  s = s.replace(find, repl);
  changed.push(label);
}

replaceOnce(
  'let D=e=>{e!==C.current&&(S.current&&window.clearTimeout(S.current),_(`leaving`),S.current=window.setTimeout(()=>{C.current=e,t(e),_(`entering`),S.current=window.setTimeout(()=>{_(`idle`),S.current=null},280)},170))}',
  'let D=e=>{e!==C.current&&(S.current&&window.clearTimeout(S.current),C.current=e,t(e),_(`idle`),S.current=null)}',
  'disable app view transition timers'
);
replaceOnce('e===`favorites`&&(0,G.jsx)(Er,{initialFace:f,animateEntry:m,onToast:M})','e===`favorites`&&(0,G.jsx)(Er,{initialFace:f,animateEntry:m,onToast:M,onRegisterBackHandler:j})','pass back handler into favorites');
replaceOnce('function Er({initialFace:e,animateEntry:t,onToast:n})','function Er({initialFace:e,animateEntry:t,onToast:n,onRegisterBackHandler:$back})','favorites accepts back handler');
replaceOnce('re=()=>{x(!1),W()},ie=()=>{i(e=>!e),o(!0),window.setTimeout(()=>o(!1),850)},ae=e=>{let t=e.touches[0];t&&(B.current={startX:t.clientX,startY:t.clientY})}','re=()=>{x(!1),W()};(0,v.useEffect)(()=>($back?.(()=>p?(m(null),y(0),!0):h?(g(null),y(0),!0):b?(re(),!0):R?(z(null),!0):!1),()=>{$back?.(null)}),[$back,p,h,b,R]);let ie=()=>{i(e=>!e),o(!0),window.setTimeout(()=>o(!1),850)},ae=e=>{let t=e.touches[0];t&&(B.current={startX:t.clientX,startY:t.clientY})}','android back closes favorites popups first');
replaceOnce('l=t=>{window.setTimeout(()=>{a.current.isDown=!1,n($n),e(t)},120)}','l=t=>{window.setTimeout(()=>{a.current.isDown=!1,n($n),e(t)},0)}','remove home navigation delay');
replaceOnce('f=e=>{e.preventDefault(),o();let{x:t,y:r,moved:i}=a.current,s=Math.hypot(t,r);if(a.current.isDown=!1,!i||s<8){m();return}if(Math.abs(t)>Math.abs(r)&&t<0&&s>24){l(`favorites`);return}if(s>48){if(Math.abs(t)>Math.abs(r)&&t>0){l(`notes`);return}if(Math.abs(r)>Math.abs(t)){l(r>0?`album`:`podcast`);return}}n(e=>({...e,x:0,y:0,rotation:0,active:!1,longPress:!1}))}','f=e=>{e.preventDefault(),o();let{x:t,y:r,moved:i}=a.current,s=Math.hypot(t,r),c=Math.abs(t),u=Math.abs(r),d=92,p=1.45;if(a.current.isDown=!1,!i||s<8){m();return}if(c>d&&c>u*p){l(t<0?`favorites`:`notes`);return}if(u>d&&u>c*p){l(r>0?`album`:`podcast`);return}n(e=>({...e,x:0,y:0,rotation:0,active:!1,longPress:!1}))}','home swipe strict fixed-region threshold');
replaceOnce('开启后，带“日记”标签的笔记只会在页面 4 明确筛选“日记”时显示。','开启后，带“日记”标签的笔记只会在笔记页明确筛选“日记”时显示。','settings diary privacy wording');
replaceOnce('(0,v.useEffect)(()=>{let e=!1;return fetch(`/recommendations/album-catalog.json`).then(e=>e.json()).then(t=>{if(e||!Array.isArray(t))return;let n=t.reduce((e,t)=>{let n=t.collection||`unknown`;return e[n]=(e[n]||0)+1,e},{}),r={"rolling-stone-500":`Rolling Stone 500`,"chinese-rock":`中国乐队专辑`,"1001-albums":`1001 Albums`,"apple-music":`Apple 实时专辑`,unknown:`其他合集`};y(Object.entries(n).map(([e,t])=>({label:r[e]||e,count:t})))}).catch(()=>void 0),()=>{e=!0}},[])','(0,v.useEffect)(()=>{let e=!1,t=window.setTimeout(()=>{fetch(`/recommendations/album-catalog.json`).then(e=>e.json()).then(t=>{if(e||!Array.isArray(t))return;let n=t.reduce((e,t)=>{let n=t.collection||`unknown`;return e[n]=(e[n]||0)+1,e},{}),r={"rolling-stone-500":`Rolling Stone 500`,"chinese-rock":`中国乐队专辑`,"1001-albums":`1001 Albums`,"apple-music":`Apple 实时专辑`,unknown:`其他合集`};y(Object.entries(n).map(([e,t])=>({label:r[e]||e,count:t})))}).catch(()=>void 0)},350);return()=>{e=!0,window.clearTimeout(t)}},[])','defer heavy settings album catalog scan');
fs.writeFileSync(path, s, 'utf8');
console.log('patched runtime:', changed.join(', '));
