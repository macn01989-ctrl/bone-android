import fs from 'node:fs';

const target = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let source = fs.readFileSync(target, 'utf8');

const replacements = [
  [
    'function Gr(){return[`audio/webm;codecs=opus`,`audio/webm`,`audio/mp4`,`audio/ogg;codecs=opus`].find(e=>MediaRecorder.isTypeSupported(e))||``}',
    'function Gr(){return[`audio/mp4`,`audio/webm;codecs=opus`,`audio/webm`,`audio/ogg;codecs=opus`].find(e=>MediaRecorder.isTypeSupported(e))||``}',
  ],
  [
    'async function Ur(e,t){let n=new FormData;n.append(`file`,new File([e],t.fileName,{type:e.type||`audio/webm`})),n.append(`model`,t.model);let r=await fetch(Pn,{method:`POST`,headers:{Authorization:`Bearer ${t.apiKey}`},body:n,signal:AbortSignal.timeout(t.timeoutMs)}),i=await r.text();if(!r.ok)throw Error(`speech api ${r.status}: ${i}`);return JSON.parse(i||`{}`)}',
    'async function Ur(e,t){let n=new FormData,r=t.mimeType||e.type||`audio/webm`;n.append(`file`,new File([e],t.fileName,{type:r})),n.append(`model`,t.model);let i=await fetch(Pn,{method:`POST`,headers:{Authorization:`Bearer ${t.apiKey}`},body:n,signal:AbortSignal.timeout(t.timeoutMs)}),a=await i.text();if(!i.ok)throw Error(`speech api ${i.status} | model=${t.model} | file=${t.fileName} | mime=${r} | bytes=${e.size||0} | body=${a||`(empty)`}`);return JSON.parse(a||`{}`)}',
  ],
  [
    'async function Wr(e,t){let n=await Jr(e),r=await Bn.postMultipartAudio({url:Pn,apiKey:t.apiKey,model:t.model,dataUrl:n,fileName:t.fileName,mimeType:e.type||`audio/webm`,timeoutMs:t.timeoutMs});if(r.status<200||r.status>=300)throw Error(`speech api ${r.status}: ${r.body||``}`);return JSON.parse(r.body||`{}`)}',
    'async function Wr(e,t){let n=await Jr(e),r=t.mimeType||e.type||`audio/webm`,i=await Bn.postMultipartAudio({url:Pn,apiKey:t.apiKey,model:t.model,dataUrl:n,fileName:t.fileName,mimeType:r,timeoutMs:t.timeoutMs});if(i.status<200||i.status>=300)throw Error(`speech api ${i.status} | model=${t.model} | file=${t.fileName} | mime=${r} | bytes=${e.size||0} | body=${i.body||`(empty)`}`);return JSON.parse(i.body||`{}`)}',
  ],
];

let changed = 0;
for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`ASR format/debug patch target not found: ${from.slice(0, 100)}`);
  }
  source = source.replace(from, to);
  changed += 1;
}

fs.writeFileSync(target, source);
console.log(`patched ASR format/debug runtime: ${changed}`);
