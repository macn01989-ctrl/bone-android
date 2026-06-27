import fs from 'node:fs';

const target = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let source = fs.readFileSync(target, 'utf8');

const anchor =
  'function qr(e){let t=16e3,n=Math.max(1,Math.floor(t*e))*2,r=new ArrayBuffer(44+n),i=new DataView(r),a=(e,t)=>{for(let n=0;n<t.length;n+=1)i.setUint8(e+n,t.charCodeAt(n))};return a(0,`RIFF`),i.setUint32(4,36+n,!0),a(8,`WAVE`),a(12,`fmt `),i.setUint32(16,16,!0),i.setUint16(20,1,!0),i.setUint16(22,1,!0),i.setUint32(24,t,!0),i.setUint32(28,t*2,!0),i.setUint16(32,2,!0),i.setUint16(34,16,!0),a(36,`data`),i.setUint32(40,n,!0),new Blob([r],{type:`audio/wav`})}';

const wavFunction =
  'async function asrWav(e){try{let t=await e.arrayBuffer(),n=window.AudioContext||window.webkitAudioContext;if(!n)return e;let r=new n,i=await r.decodeAudioData(t.slice(0)),a=16000,o=Math.max(1,Math.floor(i.duration*a)),s=new Float32Array(o),c=i.sampleRate/a,l=i.numberOfChannels;for(let e=0;e<l;e++){let t=i.getChannelData(e);for(let n=0;n<o;n++){let r=n*c,a=Math.floor(r),o=Math.min(a+1,t.length-1),l=r-a;s[n]+=(t[a]||0)*(1-l)+(t[o]||0)*l}}for(let e=0;e<o;e++)s[e]/=Math.max(1,l);r.close?.();let u=new ArrayBuffer(44+o*2),d=new DataView(u),f=(e,t)=>{for(let n=0;n<t.length;n++)d.setUint8(e+n,t.charCodeAt(n))};f(0,`RIFF`),d.setUint32(4,36+o*2,!0),f(8,`WAVE`),f(12,`fmt `),d.setUint32(16,16,!0),d.setUint16(20,1,!0),d.setUint16(22,1,!0),d.setUint32(24,a,!0),d.setUint32(28,a*2,!0),d.setUint16(32,2,!0),d.setUint16(34,16,!0),f(36,`data`),d.setUint32(40,o*2,!0);for(let e=0;e<o;e++){let t=Math.max(-1,Math.min(1,s[e]));d.setInt16(44+e*2,t<0?t*32768:t*32767,!0)}return new Blob([u],{type:`audio/wav`})}catch{return e}}';

if (!source.includes(anchor)) {
  throw new Error('WAV helper anchor not found');
}
if (!source.includes('async function asrWav(')) {
  source = source.replace(anchor, `${anchor}${wavFunction}`);
}

const from =
  'try{let e=E||`bone-recording-${Date.now()}.${Kr(t.type)}`,a=Lr(n,r.timeoutMs),o=Yr(await Hr(t,{apiKey:i,model:r.model||In,fileName:e,timeoutMs:a}));if(!o.trim()){';
const to =
  'try{let s=await asrWav(t),e=`bone-recording-${Date.now()}.wav`,a=Lr(n,r.timeoutMs),o=Yr(await Hr(s,{apiKey:i,model:r.model||In,fileName:e,mimeType:`audio/wav`,timeoutMs:a}));if(!o.trim()){';

if (!source.includes(from)) {
  throw new Error('Recorder upload call target not found');
}
source = source.replace(from, to);

fs.writeFileSync(target, source);
console.log('patched recorder ASR upload to normalized wav');
